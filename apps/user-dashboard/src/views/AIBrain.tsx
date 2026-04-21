'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getApiBaseUrl, getTenantIdClient, jsonTenantHeaders, tenantFetchHeaders } from '@/lib/backend-api';
import {
  ToggleLeft,
  ToggleRight,
  Sparkles,
  MessageCircle,
  Percent,
  Infinity,
  Upload,
  Save,
  Plus,
  Trash2,
  Wand2,
  Tag,
  Gift,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { refineMarketingCopy } from '@/lib/aiAssist';
import type { DiscountRule, PromotionItem } from '@/types';
import { useSubscription } from '@/context/SubscriptionContext';
import { pushToast } from '@/lib/toast';
import { NativeSelect } from '@/components/ui/NativeSelect';

interface BrainState {
  tone: number;
  useEmoji: boolean;
  maxDiscountPercent: number;
  spamCadence: 'week' | '14d' | 'month';
  systemPrompt: string;
  brandVoicePrompt: string;
  discounts: DiscountRule[];
  promotions: PromotionItem[];
}

const defaultState = (): BrainState => ({
  tone: 50,
  useEmoji: true,
  maxDiscountPercent: 15,
  spamCadence: 'week',
  systemPrompt:
    'Ты — вежливый ИИ-ассистент бренда. Помогаешь с заказами, акциями и лояльностью. Не обещай то, чего нет в правилах ниже.',
  brandVoicePrompt:
    'Обращайся на «вы», короткие абзацы, без канцелярита. При необходимости уточняй детали заказа.',
  discounts: [],
  promotions: [],
});

function looksLikeAiConfigStub(text: string): boolean {
  return /apps\/api\/\.env|AI_PRIMARY_PROVIDER|GEMINI_API_KEY|ANTHROPIC_API_KEY|Перезапустите API/i.test(
    text
  );
}

/** Ответ «НАЗВАНИЕ: … / ТЕКСТ: …» или эвристика по строкам. */
function parsePromotionAiSections(raw: string): { title: string; body: string } {
  const t = raw.trim();
  const titleM = t.match(/НАЗВАНИЕ:\s*([^\n]+)/i);
  const bodyM = t.match(/ТЕКСТ:\s*([\s\S]+)/i);
  let title = titleM?.[1]?.replace(/\s+/g, ' ').trim() ?? '';
  let body = bodyM?.[1]?.trim() ?? '';
  if (!title && !body) {
    const lines = t.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length >= 2) {
      title = lines[0]!.slice(0, 100);
      body = lines.slice(1).join('\n');
    } else if (lines.length === 1) {
      body = lines[0]!;
    }
  }
  return { title, body };
}

export function AIBrain() {
  const { has, subscription } = useSubscription();
  const canRefine = !subscription || has('aiRefineCopy');
  const [tenantId, setTenantId] = useState(() => getTenantIdClient());
  const [state, setState] = useState<BrainState>(defaultState);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const sync = () => setTenantId(getTenantIdClient());
    sync();
    window.addEventListener('focus', sync);
    window.addEventListener('storage', sync);
    window.addEventListener('linearize-tenant-auth', sync);
    return () => {
      window.removeEventListener('focus', sync);
      window.removeEventListener('storage', sync);
      window.removeEventListener('linearize-tenant-auth', sync);
    };
  }, []);

  useEffect(() => {
    const base = getApiBaseUrl();
    if (!base || !tenantId.trim()) {
      setState(defaultState());
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${base}/v1/tenant/${tenantId}/brain`, {
          headers: tenantFetchHeaders(),
        });
        if (cancelled) return;
        if (getTenantIdClient().trim() !== tenantId) return;
        if (r.ok) {
          const b = (await r.json()) as Partial<BrainState>;
          const def = defaultState();
          setState({
            ...def,
            ...b,
            discounts: Array.isArray(b.discounts) ? b.discounts : [],
            promotions: Array.isArray(b.promotions) ? b.promotions : [],
          });
        } else {
          setState(defaultState());
        }
      } catch {
        if (!cancelled) setState(defaultState());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  const handleSave = () => {
    const base = getApiBaseUrl();
    const tid = getTenantIdClient().trim();
    if (!base || !tid) {
      pushToast('Нет связи с API или организацией', 'error');
      return;
    }
    void (async () => {
      const r = await fetch(`${base}/v1/tenant/${tid}/brain`, {
        method: 'PUT',
        headers: jsonTenantHeaders(),
        body: JSON.stringify(state),
      });
      if (getTenantIdClient().trim() !== tid) return;
      if (r.ok) {
        setSavedAt(new Date().toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit' }));
        pushToast('Настройки ИИ сохранены', 'success');
      } else {
        pushToast('Не удалось сохранить', 'error');
      }
    })();
  };

  const onPromptFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const lower = file?.name.toLowerCase() ?? '';
    if (!file || (!lower.endsWith('.txt') && !lower.endsWith('.md'))) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      setState((s) => ({ ...s, systemPrompt: text.trim() || s.systemPrompt }));
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const refineField = async (
    key: 'systemPrompt' | 'brandVoicePrompt',
    instruction: string
  ) => {
    if (!canRefine) {
      pushToast('ИИ-доработка текстов доступна с тарифа Starter и выше', 'error');
      return;
    }
    const field = key;
    setAiLoading(field);
    const { text, error } = await refineMarketingCopy(instruction, state[field]);
    setAiLoading(null);
    if (error?.trim()) {
      pushToast(error.trim().slice(0, 400), 'error');
      return;
    }
    const trimmed = text.trim();
    if (!trimmed || looksLikeAiConfigStub(trimmed)) {
      pushToast(
        'ИИ не вернул текст. Задайте GEMINI_API_KEY / ANTHROPIC_API_KEY в apps/api/.env или NEXT_PUBLIC_GEMINI_API_KEY в панели.',
        'error'
      );
      return;
    }
    setState((s) => ({ ...s, [field]: trimmed }));
  };

  const generateSystemPrompt = async () => {
    if (!canRefine) {
      pushToast('ИИ-доработка текстов доступна с тарифа Starter и выше', 'error');
      return;
    }
    setAiLoading('g-systemPrompt');
    const instruction =
      'С нуля составь системный промпт для чат-бота интернет-магазина или сервиса на русском: роль ассистента, что может и чего не может, когда передать человеку. 6–14 предложений, конкретно, без воды. Только текст промпта, без заголовков «Системный промпт».';
    const draft = state.systemPrompt.trim()
      ? `Можно опереться на идеи черновика и переписать полностью:\n${state.systemPrompt}`
      : 'Черновика нет — придумай с нуля под типичный B2C.';
    const { text, error } = await refineMarketingCopy(instruction, draft);
    setAiLoading(null);
    if (error?.trim()) {
      pushToast(error.trim().slice(0, 400), 'error');
      return;
    }
    const trimmed = text.trim();
    if (!trimmed || looksLikeAiConfigStub(trimmed)) {
      pushToast(
        'ИИ не вернул текст. Задайте ключи на API или NEXT_PUBLIC_GEMINI_API_KEY в панели.',
        'error'
      );
      return;
    }
    setState((s) => ({ ...s, systemPrompt: trimmed }));
    pushToast('Системный промпт сгенерирован', 'success');
  };

  const generateBrandVoicePrompt = async () => {
    if (!canRefine) {
      pushToast('ИИ-доработка текстов доступна с тарифа Starter и выше', 'error');
      return;
    }
    setAiLoading('g-brandVoicePrompt');
    const instruction =
      'С нуля опиши голос бренда для переписки с клиентом на русском: обращение на «вы» или «ты», длина сообщений, эмодзи уместны или нет, чего избегать. 4–8 предложений. Только текст гайда, без преамбулы.';
    const draft = state.brandVoicePrompt.trim()
      ? `Черновик (можно заменить полностью):\n${state.brandVoicePrompt}`
      : 'Черновика нет.';
    const { text, error } = await refineMarketingCopy(instruction, draft);
    setAiLoading(null);
    if (error?.trim()) {
      pushToast(error.trim().slice(0, 400), 'error');
      return;
    }
    const trimmed = text.trim();
    if (!trimmed || looksLikeAiConfigStub(trimmed)) {
      pushToast(
        'ИИ не вернул текст. Задайте ключи на API или NEXT_PUBLIC_GEMINI_API_KEY в панели.',
        'error'
      );
      return;
    }
    setState((s) => ({ ...s, brandVoicePrompt: trimmed }));
    pushToast('Голос бренда сгенерирован', 'success');
  };

  const refineDiscountDesc = async (id: string) => {
    if (!canRefine) {
      pushToast('ИИ-доработка текстов доступна с тарифа Starter и выше', 'error');
      return;
    }
    const row = state.discounts.find((d) => d.id === id);
    if (!row) return;
    setAiLoading(`d-${id}`);
    const instruction =
      'Дай 1–2 короткие фразы: кому и когда скидка, что получает клиент. Простой язык для оператора и для контекста ИИ. ' +
      'Ответ — только текст описания. Код промо и процент не дублируй (они задаются в полях формы).';
    const draft = [
      `Код: ${row.code}`,
      `Процент: ${row.percent}%`,
      `Описание сейчас: ${row.description.trim() || '—'}`,
    ].join('\n');
    const { text, error } = await refineMarketingCopy(instruction, draft);
    setAiLoading(null);
    if (error?.trim()) {
      pushToast(error.trim().slice(0, 400), 'error');
      return;
    }
    const trimmed = text.trim();
    if (!trimmed || looksLikeAiConfigStub(trimmed)) {
      pushToast(
        'ИИ не вернул текст. Задайте ключи на API или NEXT_PUBLIC_GEMINI_API_KEY в панели.',
        'error'
      );
      return;
    }
    setState((s) => ({
      ...s,
      discounts: s.discounts.map((d) => (d.id === id ? { ...d, description: trimmed } : d)),
    }));
  };

  const generateDiscountDesc = async (id: string) => {
    if (!canRefine) {
      pushToast('ИИ-доработка текстов доступна с тарифа Starter и выше', 'error');
      return;
    }
    const row = state.discounts.find((d) => d.id === id);
    if (!row) return;
    setAiLoading(`gd-${id}`);
    const instruction =
      'С нуля придумай короткое описание скидки/промокода для покупателя на русском (1–2 предложения): кому выгодно, как применить при заказе. Простой разговорный язык. Только текст описания, без префикса «Описание:».';
    const draft = `Код (для контекста, не обязательно произносить клиенту дословно): ${row.code}\nПроцент: ${row.percent}%`;
    const { text, error } = await refineMarketingCopy(instruction, draft);
    setAiLoading(null);
    if (error?.trim()) {
      pushToast(error.trim().slice(0, 400), 'error');
      return;
    }
    const trimmed = text.trim();
    if (!trimmed || looksLikeAiConfigStub(trimmed)) {
      pushToast(
        'ИИ не вернул текст. Задайте ключи на API или NEXT_PUBLIC_GEMINI_API_KEY в панели.',
        'error'
      );
      return;
    }
    setState((s) => ({
      ...s,
      discounts: s.discounts.map((d) => (d.id === id ? { ...d, description: trimmed } : d)),
    }));
    pushToast('Описание промокода сгенерировано', 'success');
  };

  const refinePromotionBody = async (id: string) => {
    if (!canRefine) {
      pushToast('ИИ-доработка текстов доступна с тарифа Starter и выше', 'error');
      return;
    }
    const row = state.promotions.find((p) => p.id === id);
    if (!row) return;
    setAiLoading(`p-${id}`);
    const { text, error } = await refineMarketingCopy(
      'Перепиши текст акции для клиента: дружелюбно, без воды, с дедлайном если уместно.',
      `${row.title}. ${row.body} До ${row.validUntil}.`
    );
    setAiLoading(null);
    if (error?.trim()) {
      pushToast(error.trim().slice(0, 400), 'error');
      return;
    }
    const trimmed = text.trim();
    if (!trimmed || looksLikeAiConfigStub(trimmed)) {
      pushToast(
        'ИИ не вернул текст. Задайте ключи на API или NEXT_PUBLIC_GEMINI_API_KEY в панели.',
        'error'
      );
      return;
    }
    setState((s) => ({
      ...s,
      promotions: s.promotions.map((p) => (p.id === id ? { ...p, body: trimmed } : p)),
    }));
  };

  const generatePromotionCard = async (id: string) => {
    if (!canRefine) {
      pushToast('ИИ-доработка текстов доступна с тарифа Starter и выше', 'error');
      return;
    }
    const row = state.promotions.find((p) => p.id === id);
    if (!row) return;
    setAiLoading(`gp-${id}`);
    const instruction = [
      'Придумай с нуля название и текст акции для клиента на русском, дружелюбно, без воды.',
      `Дата окончания (если указана): ${row.validUntil}.`,
      'Строго соблюдай формат — две секции, слова НАЗВАНИЕ и ТЕКСТ заглавными с двоеточием:',
      'НАЗВАНИЕ: <короткое название, одна строка>',
      'ТЕКСТ: <условия для клиента, 1–3 коротких абзаца>',
    ].join('\n');
    const draft = row.title.trim() || row.body.trim()
      ? `Черновик (можно заменить полностью):\nНазвание: ${row.title}\nТекст: ${row.body || '—'}`
      : 'Черновика нет — придумай тематическую акцию сам (например сезонная или на первый заказ).';
    const { text, error } = await refineMarketingCopy(instruction, draft);
    setAiLoading(null);
    if (error?.trim()) {
      pushToast(error.trim().slice(0, 400), 'error');
      return;
    }
    const trimmed = text.trim();
    if (!trimmed || looksLikeAiConfigStub(trimmed)) {
      pushToast(
        'ИИ не вернул текст. Задайте ключи на API или NEXT_PUBLIC_GEMINI_API_KEY в панели.',
        'error'
      );
      return;
    }
    const { title: newTitle, body: newBody } = parsePromotionAiSections(trimmed);
    if (!newBody.trim()) {
      pushToast('ИИ вернул ответ без текста акции — попробуйте ещё раз.', 'error');
      return;
    }
    setState((s) => ({
      ...s,
      promotions: s.promotions.map((p) =>
        p.id === id
          ? {
              ...p,
              title: newTitle.trim() || p.title,
              body: newBody.trim(),
            }
          : p
      ),
    }));
    pushToast('Название и текст акции сгенерированы', 'success');
  };

  const addDiscount = () => {
    const id = `d-${Date.now()}`;
    setState((s) => ({
      ...s,
      discounts: [
        ...s.discounts,
        { id, code: 'NEW', percent: 5, description: '', active: true },
      ],
    }));
  };

  const addPromotion = () => {
    const id = `p-${Date.now()}`;
    setState((s) => ({
      ...s,
      promotions: [
        ...s.promotions,
        {
          id,
          title: 'Новая акция',
          body: '',
          validUntil: new Date().toISOString().slice(0, 10),
          active: true,
        },
      ],
    }));
  };

  return (
    <div className="crm-page crm-page--narrow custom-scrollbar space-y-8 sm:space-y-10 fade-in pb-20 sm:pb-24">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="crm-page-h1 flex items-center gap-3 flex-wrap">
            <Sparkles className="w-7 h-7 sm:w-8 sm:h-8 text-[#3b82f6] shrink-0" />
            <span>Настройки ИИ-Маркетолога</span>
          </h1>
          <p className="crm-page-lead max-w-2xl mt-3">
            Промпты, скидки и акции попадают в контекст модели: так ИИ говорит в голосе бренда и не
            нарушает ваши правила. Кнопки «Сгенерировать» и «Доработать с ИИ» ходят в API; модель Gemini
            задаётся{' '}
            <code className="text-xs text-[#a1a1aa]">GEMINI_MODEL</code> в apps/api/.env (по умолчанию{' '}
            <code className="text-xs text-[#a1a1aa]">gemini-2.5-flash</code>).
          </p>
          {!canRefine && subscription ? (
            <p className="mt-3 text-sm text-amber-200/90 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 max-w-2xl">
              Кнопки ИИ для текстов отключены на текущем тарифе.{' '}
              <Link href="/billing" className="text-amber-200 underline underline-offset-2">
                Сменить тариф
              </Link>
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {savedAt && (
            <span className="text-xs text-[#71717a]">Сохранено {savedAt}</span>
          )}
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#3b82f6] text-white text-sm font-semibold hover:bg-[#2563eb] transition-colors shadow-[0_0_20px_rgba(59,130,246,0.25)]"
          >
            <Save className="w-4 h-4" />
            Сохранить
          </button>
        </div>
      </div>

      {/* Prompts */}
      <div className="crm-card p-6 md:p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#8b5cf6]/10 flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-[#8b5cf6]" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-medium text-white">Промпты для диалога</h2>
            <p className="text-sm text-[#71717a]">Системные инструкции и стиль бренда</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,text/plain,text/markdown"
            className="hidden"
            onChange={onPromptFile}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[#1f1f22] text-sm text-[#d4d4d8] hover:bg-[#121214]"
          >
            <Upload className="w-4 h-4" />
            Загрузить .txt / .md
          </button>
        </div>

        <div>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-2">
            <label className="text-sm font-medium text-[#d4d4d8]">Системный промпт</label>
            <div className="flex flex-wrap gap-2 justify-end">
              <button
                type="button"
                disabled={!!aiLoading || !canRefine}
                onClick={() => void generateSystemPrompt()}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 disabled:opacity-50"
              >
                {aiLoading === 'g-systemPrompt' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                Сгенерировать с ИИ
              </button>
              <button
                type="button"
                disabled={!!aiLoading || !canRefine}
                onClick={() =>
                  void refineField(
                    'systemPrompt',
                    'Улучши системный промпт: чёткие запреты, роль, границы ответственности. Язык: русский.'
                  )
                }
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8b5cf6] hover:text-[#a78bfa] disabled:opacity-50"
              >
                {aiLoading === 'systemPrompt' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Wand2 className="w-3.5 h-3.5" />
                )}
                Доработать с ИИ
              </button>
            </div>
          </div>
          <textarea
            value={state.systemPrompt}
            onChange={(e) => setState((s) => ({ ...s, systemPrompt: e.target.value }))}
            rows={5}
            className="w-full bg-[#121214] border border-[#1f1f22] rounded-lg px-4 py-3 text-sm text-[#e4e4e7] placeholder:text-[#52525b] focus:outline-none focus:border-[#8b5cf6]/50 resize-y min-h-[120px]"
            placeholder="Кто такой ассистент, что может и чего не может…"
          />
        </div>

        <div>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-2">
            <label className="text-sm font-medium text-[#d4d4d8]">Голос бренда</label>
            <div className="flex flex-wrap gap-2 justify-end">
              <button
                type="button"
                disabled={!!aiLoading || !canRefine}
                onClick={() => void generateBrandVoicePrompt()}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 disabled:opacity-50"
              >
                {aiLoading === 'g-brandVoicePrompt' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                Сгенерировать с ИИ
              </button>
              <button
                type="button"
                disabled={!!aiLoading || !canRefine}
                onClick={() =>
                  void refineField(
                    'brandVoicePrompt',
                    'Сформулируй краткий гайдлайн тона: обращение, длина фраз, эмодзи по желанию.'
                  )
                }
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8b5cf6] hover:text-[#a78bfa] disabled:opacity-50"
              >
                {aiLoading === 'brandVoicePrompt' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Wand2 className="w-3.5 h-3.5" />
                )}
                Доработать с ИИ
              </button>
            </div>
          </div>
          <textarea
            value={state.brandVoicePrompt}
            onChange={(e) => setState((s) => ({ ...s, brandVoicePrompt: e.target.value }))}
            rows={4}
            className="w-full bg-[#121214] border border-[#1f1f22] rounded-lg px-4 py-3 text-sm text-[#e4e4e7] focus:outline-none focus:border-[#8b5cf6]/50 resize-y"
          />
        </div>
      </div>

      {/* Discounts table */}
      <div className="crm-card p-6 md:p-8 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#10b981]/10 flex items-center justify-center">
              <Tag className="w-5 h-5 text-[#10b981]" />
            </div>
            <div>
              <h2 className="text-lg font-medium text-white">Скидки и промокоды</h2>
              <p className="text-sm text-[#71717a]">ИИ будет опираться на эти правила</p>
            </div>
          </div>
          <button
            type="button"
            onClick={addDiscount}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[#10b981]/30 text-[#10b981] text-sm font-medium hover:bg-[#10b981]/10"
          >
            <Plus className="w-4 h-4" />
            Добавить
          </button>
        </div>

        <div className="overflow-x-auto rounded-lg border border-[#1f1f22]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#121214] text-[11px] uppercase tracking-wider text-[#71717a]">
              <tr>
                <th className="px-4 py-3 font-medium">Код</th>
                <th className="px-4 py-3 font-medium">%</th>
                <th className="px-4 py-3 font-medium min-w-[200px]">Описание</th>
                <th className="px-4 py-3 font-medium">Вкл</th>
                <th className="px-4 py-3 w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1f1f22] text-[#d4d4d8]">
              {state.discounts.map((d) => (
                <tr key={d.id} className="hover:bg-[#121214]/40">
                  <td className="px-4 py-3">
                    <input
                      value={d.code}
                      onChange={(e) =>
                        setState((s) => ({
                          ...s,
                          discounts: s.discounts.map((x) =>
                            x.id === d.id ? { ...x, code: e.target.value.toUpperCase() } : x
                          ),
                        }))
                      }
                      className="w-full bg-[#0a0a0c] border border-[#1f1f22] rounded px-2 py-1 text-xs font-mono"
                    />
                  </td>
                  <td className="px-4 py-3 w-20">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={d.percent}
                      onChange={(e) =>
                        setState((s) => ({
                          ...s,
                          discounts: s.discounts.map((x) =>
                            x.id === d.id
                              ? { ...x, percent: Math.min(100, Math.max(0, +e.target.value || 0)) }
                              : x
                          ),
                        }))
                      }
                      className="w-full bg-[#0a0a0c] border border-[#1f1f22] rounded px-2 py-1 text-xs"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <textarea
                      value={d.description}
                      onChange={(e) =>
                        setState((s) => ({
                          ...s,
                          discounts: s.discounts.map((x) =>
                            x.id === d.id ? { ...x, description: e.target.value } : x
                          ),
                        }))
                      }
                      rows={2}
                      className="w-full bg-[#0a0a0c] border border-[#1f1f22] rounded px-2 py-1 text-xs resize-y min-h-[48px]"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() =>
                        setState((s) => ({
                          ...s,
                          discounts: s.discounts.map((x) =>
                            x.id === d.id ? { ...x, active: !x.active } : x
                          ),
                        }))
                      }
                      className="text-[#71717a] hover:text-white"
                    >
                      {d.active ? (
                        <ToggleRight className="w-7 h-7 text-[#10b981]" />
                      ) : (
                        <ToggleLeft className="w-7 h-7" />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-0.5 justify-end">
                      <button
                        type="button"
                        title="Сгенерировать с ИИ"
                        disabled={!!aiLoading || !canRefine}
                        onClick={() => void generateDiscountDesc(d.id)}
                        className="p-2 rounded-lg hover:bg-[#1f1f22] text-emerald-400"
                      >
                        {aiLoading === `gd-${d.id}` ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Sparkles className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        title="Доработать с ИИ"
                        disabled={!!aiLoading || !canRefine}
                        onClick={() => void refineDiscountDesc(d.id)}
                        className="p-2 rounded-lg hover:bg-[#1f1f22] text-[#8b5cf6]"
                      >
                        {aiLoading === `d-${d.id}` ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Wand2 className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        title="Удалить"
                        onClick={() =>
                          setState((s) => ({
                            ...s,
                            discounts: s.discounts.filter((x) => x.id !== d.id),
                          }))
                        }
                        className="p-2 rounded-lg hover:bg-red-500/10 text-[#71717a] hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-[#71717a]">
          Глобальный потолок скидки задаётся ниже — ИИ не превысит его, даже если в таблице указано
          больше.
        </p>
      </div>

      {/* Promotions */}
      <div className="crm-card p-6 md:p-8 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#f59e0b]/10 flex items-center justify-center">
              <Gift className="w-5 h-5 text-[#f59e0b]" />
            </div>
            <div>
              <h2 className="text-lg font-medium text-white">Акции и кампании</h2>
              <p className="text-sm text-[#71717a]">ИИ сможет кратко объяснять условия клиенту</p>
            </div>
          </div>
          <button
            type="button"
            onClick={addPromotion}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[#f59e0b]/30 text-[#f59e0b] text-sm font-medium hover:bg-[#f59e0b]/10"
          >
            <Plus className="w-4 h-4" />
            Добавить акцию
          </button>
        </div>

        <div className="space-y-4">
          {state.promotions.map((p) => (
            <div
              key={p.id}
              className="rounded-xl border border-[#1f1f22] bg-[#121214]/40 p-4 space-y-3"
            >
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                <input
                  value={p.title}
                  onChange={(e) =>
                    setState((s) => ({
                      ...s,
                      promotions: s.promotions.map((x) =>
                        x.id === p.id ? { ...x, title: e.target.value } : x
                      ),
                    }))
                  }
                  className="flex-1 bg-[#0a0a0c] border border-[#1f1f22] rounded-lg px-3 py-2 text-sm text-white font-medium"
                  placeholder="Название акции"
                />
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-[#71717a] whitespace-nowrap">до</span>
                  <input
                    type="date"
                    value={p.validUntil}
                    onChange={(e) =>
                      setState((s) => ({
                        ...s,
                        promotions: s.promotions.map((x) =>
                          x.id === p.id ? { ...x, validUntil: e.target.value } : x
                        ),
                      }))
                    }
                    className="bg-[#0a0a0c] border border-[#1f1f22] rounded-lg px-3 py-2 text-xs text-[#d4d4d8]"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setState((s) => ({
                        ...s,
                        promotions: s.promotions.map((x) =>
                          x.id === p.id ? { ...x, active: !x.active } : x
                        ),
                      }))
                    }
                    className="text-[#71717a]"
                  >
                    {p.active ? (
                      <ToggleRight className="w-7 h-7 text-[#f59e0b]" />
                    ) : (
                      <ToggleLeft className="w-7 h-7" />
                    )}
                  </button>
                </div>
              </div>
              <textarea
                value={p.body}
                onChange={(e) =>
                  setState((s) => ({
                    ...s,
                    promotions: s.promotions.map((x) =>
                      x.id === p.id ? { ...x, body: e.target.value } : x
                    ),
                  }))
                }
                rows={3}
                className="w-full bg-[#0a0a0c] border border-[#1f1f22] rounded-lg px-3 py-2 text-sm text-[#d4d4d8] resize-y"
                placeholder="Условия акции для клиента…"
              />
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  disabled={!!aiLoading || !canRefine}
                  onClick={() => void generatePromotionCard(p.id)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-400 hover:bg-emerald-500/10"
                >
                  {aiLoading === `gp-${p.id}` ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  Сгенерировать с ИИ
                </button>
                <button
                  type="button"
                  disabled={!!aiLoading || !canRefine}
                  onClick={() => void refinePromotionBody(p.id)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#8b5cf6] hover:bg-[#8b5cf6]/10"
                >
                  {aiLoading === `p-${p.id}` ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Wand2 className="w-3.5 h-3.5" />
                  )}
                  Доработать текст с ИИ
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setState((s) => ({
                      ...s,
                      promotions: s.promotions.filter((x) => x.id !== p.id),
                    }))
                  }
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-[#71717a] hover:text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Удалить
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tone + financial cap */}
      <div className="crm-card p-6 md:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-[#3b82f6]/10 flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-[#3b82f6]" />
          </div>
          <div>
            <h2 className="text-lg font-medium text-white">Тон общения</h2>
            <p className="text-sm text-[#71717a]">Как ИИ строит диалог поверх промптов</p>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <div className="flex justify-between text-sm font-medium text-[#d4d4d8] mb-4">
              <span>Строгий (официально)</span>
              <span>Дружелюбный (на «ты»)</span>
            </div>
            <input
              type="range"
              className="w-full accent-[#3b82f6] outline-none"
              min={0}
              max={100}
              value={state.tone}
              onChange={(e) =>
                setState((s) => ({ ...s, tone: parseInt(e.target.value, 10) }))
              }
            />
          </div>

          <button
            type="button"
            onClick={() => setState((s) => ({ ...s, useEmoji: !s.useEmoji }))}
            className={cn(
              'flex items-center gap-3 text-sm font-medium transition-colors p-3 rounded-lg border w-full sm:w-auto',
              state.useEmoji
                ? 'bg-[#3b82f6]/10 border-[#3b82f6]/20 text-white'
                : 'bg-transparent border-[#1f1f22] text-[#71717a] hover:bg-[#121214]'
            )}
          >
            Использовать эмодзи в сообщениях {state.useEmoji ? '🥰' : ''}
            {state.useEmoji ? (
              <ToggleRight className="w-6 h-6 text-[#3b82f6] ml-auto" />
            ) : (
              <ToggleLeft className="w-6 h-6 ml-auto" />
            )}
          </button>
        </div>
      </div>

      <div className="crm-card p-6 md:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-[#10b981]/10 flex items-center justify-center">
            <Percent className="w-5 h-5 text-[#10b981]" />
          </div>
          <div>
            <h2 className="text-lg font-medium text-white">Потолок скидки для ИИ</h2>
            <p className="text-sm text-[#71717a]">Максимальный процент, который бот может предложить сам</p>
          </div>
        </div>

        <div className="flex justify-between items-end mb-4">
          <span className="text-sm font-medium text-[#d4d4d8]">Максимальный процент</span>
          <span className="text-2xl font-bold text-white bg-[#121214] border border-[#1f1f22] px-4 py-1.5 rounded-lg">
            {state.maxDiscountPercent}%
          </span>
        </div>
        <input
          type="range"
          className="w-full accent-[#10b981] outline-none"
          min={0}
          max={100}
          value={state.maxDiscountPercent}
          onChange={(e) =>
            setState((s) => ({ ...s, maxDiscountPercent: parseInt(e.target.value, 10) }))
          }
        />
      </div>

      <div className="crm-card p-6 md:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-[#f59e0b]/10 flex items-center justify-center">
            <Infinity className="w-5 h-5 text-[#f59e0b]" />
          </div>
          <div>
            <h2 className="text-lg font-medium text-white">Анти-спам</h2>
            <p className="text-sm text-[#71717a]">Как часто можно писать одному клиенту</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 sm:gap-4 min-w-0">
          <span className="text-sm text-white shrink-0">Не писать чаще, чем</span>
          <NativeSelect
            variant="field"
            className="w-full sm:w-auto sm:min-w-[200px]"
            value={state.spamCadence}
            onChange={(e) =>
              setState((s) => ({
                ...s,
                spamCadence: e.target.value as BrainState['spamCadence'],
              }))
            }
            aria-label="Частота сообщений анти-спам"
          >
            <option value="week">1 раз в неделю</option>
            <option value="14d">1 раз в 14 дней</option>
            <option value="month">1 раз в месяц</option>
          </NativeSelect>
        </div>
      </div>
    </div>
  );
}
