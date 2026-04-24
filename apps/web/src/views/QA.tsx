'use client';

import React, { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Hand,
  CheckCircle,
  Search,
  ChevronUp,
  ChevronDown,
  Shield,
  Send,
  UserCircle2,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { getApiBaseUrl, getTenantIdClient, jsonTenantHeaders, tenantFetchHeaders } from '@/lib/backend-api';
import { apiFetchJson } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import type { QAChannel, QADialogue, QADialogueMessage, QADialogueStatus } from '@/types';
import { useSubscription } from '@/context/SubscriptionContext';
import { pushToast } from '@/lib/toast';
import Link from 'next/link';
import { NativeSelect } from '@/components/ui/NativeSelect';
import {
  OUTREACH_LETTER_QA_KEY,
  type OutreachLetterQaPayload,
} from '@/lib/outreach-qa-bridge';

const SUPPORT_QA_SYNC_ID = '__platform_support_v1';
const QA_AUTO_SUGGEST_KEY = 'linearize-qa-auto-suggest';

/** Слова/корни: клиент недоволен, срочность, юридические сигналы — для бейджа «нужен ответ». */
const ATTENTION_KEYWORDS = [
  'жалоб',
  'возврат',
  'срочн',
  'обман',
  'суд',
  'прокурор',
  'не пришл',
  'не работает',
  'ошибк',
  'требую',
  'недовол',
  'верните деньги',
  'разочаров',
  'обманули',
  'брак',
];

function formatDialogueForSuggest(d: QADialogue): string {
  return d.messages
    .map((m) => {
      const role =
        m.sender === 'ai'
          ? 'ИИ'
          : m.sender === 'client'
            ? 'Клиент'
            : m.sender === 'manager'
              ? 'Менеджер'
              : 'Система';
      return `${role}: ${m.content}`;
    })
    .join('\n');
}

function lastNonSystemMessage(d: QADialogue): QADialogueMessage | undefined {
  for (let i = d.messages.length - 1; i >= 0; i--) {
    if (d.messages[i].sender !== 'system') return d.messages[i];
  }
  return undefined;
}

/** Тред в очереди внимания: статус, последнее от клиента или триггерные формулировки. */
function threadNeedsAttention(d: QADialogue): boolean {
  if (d.status === 'warning' || d.status === 'intercepted') return true;
  if (d.status === 'success') return false;
  const last = lastNonSystemMessage(d);
  if (last?.sender === 'client') return true;
  const blob = `${d.issue}\n${d.messages
    .slice(-4)
    .map((m) => m.content)
    .join(' ')}`.toLowerCase();
  return ATTENTION_KEYWORDS.some((k) => blob.includes(k));
}

type QAStatusFilter = QADialogueStatus | 'all' | 'needs_attention';

const CHANNEL_LABEL: Record<QAChannel, string> = {
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  sms: 'SMS',
  email: 'Email',
  support: 'Поддержка',
};

const STATUS_LABEL: Record<QADialogueStatus, string> = {
  warning: 'Требует внимания',
  intercepted: 'Перехвачен',
  success: 'Успешно',
  active: 'В диалоге',
};

function statusColor(status: QADialogueStatus): string {
  switch (status) {
    case 'warning':
      return '#f59e0b';
    case 'intercepted':
      return '#3b82f6';
    case 'success':
      return '#10b981';
    default:
      return '#71717a';
  }
}

export function QA() {
  const searchParams = useSearchParams();
  const apiBase = getApiBaseUrl();
  const { has, subscription } = useSubscription();
  const qaFull = !subscription || has('qaFullAccess');
  const [tenantId, setTenantId] = useState(() => getTenantIdClient());
  const skipNextRemotePersist = useRef(true);

  const [outreachLetterPreview, setOutreachLetterPreview] = useState<OutreachLetterQaPayload | null>(null);

  const [dialogues, setDialogues] = useState<QADialogue[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState<QAChannel | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<QAStatusFilter>('all');
  const [draft, setDraft] = useState('');
  const [hydratedFromApi, setHydratedFromApi] = useState(false);
  const [autoSuggestOnIntercept, setAutoSuggestOnIntercept] = useState(true);
  const [suggestLoading, setSuggestLoading] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(QA_AUTO_SUGGEST_KEY);
      if (v === '0') setAutoSuggestOnIntercept(false);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (searchParams.get('from') !== 'outreach') return;
    try {
      const raw = sessionStorage.getItem(OUTREACH_LETTER_QA_KEY);
      if (!raw) return;
      const o = JSON.parse(raw) as OutreachLetterQaPayload;
      if (typeof o.ts !== 'number' || Date.now() - o.ts > 15 * 60_000) {
        sessionStorage.removeItem(OUTREACH_LETTER_QA_KEY);
        return;
      }
      setOutreachLetterPreview(o);
      sessionStorage.removeItem(OUTREACH_LETTER_QA_KEY);
    } catch {
      sessionStorage.removeItem(OUTREACH_LETTER_QA_KEY);
    }
  }, [searchParams]);

  const setAutoSuggestPreference = useCallback((on: boolean) => {
    setAutoSuggestOnIntercept(on);
    try {
      localStorage.setItem(QA_AUTO_SUGGEST_KEY, on ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, []);

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
    if (!apiBase || !tenantId.trim()) {
      setHydratedFromApi(true);
      setDialogues([]);
      setSelectedId('');
      return;
    }
    let cancelled = false;
    setHydratedFromApi(false);
    (async () => {
      const res = await apiFetchJson<QADialogue[]>(`${apiBase}/v1/tenant/${tenantId}/qa`, {
        headers: tenantFetchHeaders(),
        retries: 2,
        silent: true,
      });
      if (cancelled) return;
      if (res.ok && Array.isArray(res.data)) {
        skipNextRemotePersist.current = true;
        setDialogues(res.data);
        setSelectedId((prev) => (prev && res.data!.some((d) => d.id === prev) ? prev : res.data![0]?.id ?? ''));
      } else {
        if (!res.ok && res.error) pushToast(`QA: ${res.error}`, 'error');
        skipNextRemotePersist.current = true;
        setDialogues([]);
        setSelectedId('');
      }
      if (!cancelled) setHydratedFromApi(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [apiBase, tenantId]);

  /** Подтягиваем только тред «Поддержка» из чата без полной перезагрузки QA. */
  useEffect(() => {
    if (!apiBase || !tenantId.trim() || !hydratedFromApi) return;
    const tick = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      void (async () => {
        const res = await apiFetchJson<QADialogue[]>(`${apiBase}/v1/tenant/${tenantId}/qa`, {
          headers: tenantFetchHeaders(),
          retries: 0,
          silent: true,
        });
        if (!res.ok || !Array.isArray(res.data)) return;
        const freshSupport = res.data.find((d) => d.id === SUPPORT_QA_SYNC_ID);
        if (!freshSupport) return;
        skipNextRemotePersist.current = true;
        setDialogues((prev) => {
          const rest = prev.filter((d) => d.id !== SUPPORT_QA_SYNC_ID);
          return [...rest, freshSupport];
        });
      })();
    };
    const id = window.setInterval(tick, 12_000);
    return () => clearInterval(id);
  }, [apiBase, tenantId, hydratedFromApi]);

  useEffect(() => {
    if (!apiBase || !hydratedFromApi) return;
    if (skipNextRemotePersist.current) {
      skipNextRemotePersist.current = false;
      return;
    }
    const t = setTimeout(() => {
      void apiFetchJson(`${apiBase}/v1/tenant/${tenantId}/qa`, {
        method: 'PUT',
        headers: jsonTenantHeaders(),
        body: JSON.stringify(dialogues),
        retries: 1,
      });
    }, 700);
    return () => clearTimeout(t);
  }, [dialogues, apiBase, tenantId, hydratedFromApi]);

  const sorted = useMemo(
    () => [...dialogues].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)),
    [dialogues]
  );

  const filtered = useMemo(() => {
    return sorted.filter((d) => {
      if (channelFilter !== 'all' && d.channel !== channelFilter) return false;
      if (statusFilter === 'needs_attention') {
        if (!threadNeedsAttention(d)) return false;
      } else if (statusFilter !== 'all' && d.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const inClient = d.client.toLowerCase().includes(q);
        const inIssue = d.issue.toLowerCase().includes(q);
        const inMsg = d.messages.some((m) => m.content.toLowerCase().includes(q));
        if (!inClient && !inIssue && !inMsg) return false;
      }
      return true;
    });
  }, [sorted, channelFilter, statusFilter, search]);

  const selected = filtered.find((d) => d.id === selectedId) ?? filtered[0] ?? null;

  useEffect(() => {
    if (selectedId && filtered.some((d) => d.id === selectedId)) return;
    if (filtered[0]) setSelectedId(filtered[0].id);
  }, [filtered, selectedId]);

  const needAttentionCount = useMemo(() => dialogues.filter(threadNeedsAttention).length, [dialogues]);

  const fillSuggestDraft = useCallback(
    async (d: QADialogue) => {
      if (!apiBase || !tenantId.trim() || !qaFull) return;
      setSuggestLoading(true);
      const dialogue = formatDialogueForSuggest(d);
      const res = await apiFetchJson<{ text?: string; error?: string; provider?: string }>(
        `${apiBase}/v1/tenant/${tenantId}/ai/suggest-reply`,
        {
          method: 'POST',
          headers: jsonTenantHeaders(),
          body: JSON.stringify({
            dialogue,
            channel: d.channel,
            issue: d.issue,
          }),
          retries: 1,
          silent: true,
        }
      );
      setSuggestLoading(false);
      if (!res.ok) {
        pushToast(res.error || 'Не удалось получить подсказку ИИ', 'error');
        return;
      }
      const text = String(res.data.text ?? '').trim();
      if (!text) {
        pushToast(res.data.error?.trim() || 'ИИ не вернул текст ответа', 'error');
        return;
      }
      setDraft(text);
      if (res.data.error?.trim()) {
        pushToast(`Подсказка получена с замечанием: ${res.data.error}`, 'info');
      } else {
        pushToast('Черновик ответа подставлен в поле ниже', 'success');
      }
    },
    [apiBase, tenantId, qaFull]
  );

  const navigateList = useCallback(
    (dir: -1 | 1) => {
      if (!filtered.length) return;
      const idx = filtered.findIndex((d) => d.id === selectedId);
      const nextIdx = idx < 0 ? 0 : Math.min(filtered.length - 1, Math.max(0, idx + dir));
      setSelectedId(filtered[nextIdx].id);
    },
    [filtered, selectedId]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === 'Escape') (e.target as HTMLElement).blur();
        return;
      }
      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        navigateList(1);
      }
      if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        navigateList(-1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigateList]);

  const intercept = useCallback(
    (id: string) => {
      const row = dialogues.find((d) => d.id === id);
      if (row?.channel === 'support') {
        pushToast('Чат поддержки ведётся в разделе «Поддержка»; перехват здесь не используется.', 'error');
        return;
      }
      if (!qaFull) {
        pushToast('Перехват диалогов доступен с полным QA (тариф Starter и выше)', 'error');
        return;
      }
      const updatedAt = new Date().toISOString().slice(0, 19);
      const managerNote =
        'Диалог перехвачен. ИИ приостановлен — напишите ответ ниже или используйте подсказку ИИ; сообщение уйдёт клиенту после подключения канала.';
      setDialogues((prev) =>
        prev.map((d) =>
          d.id === id
            ? {
                ...d,
                status: 'intercepted' as const,
                managerNote,
                updatedAt,
              }
            : d
        )
      );
      if (row && autoSuggestOnIntercept) {
        void fillSuggestDraft({
          ...row,
          status: 'intercepted',
          managerNote,
          updatedAt,
        });
      }
    },
    [dialogues, qaFull, autoSuggestOnIntercept, fillSuggestDraft]
  );

  const markResolved = (id: string) => {
    setDialogues((prev) =>
      prev.map((d) =>
        d.id === id
          ? {
              ...d,
              status: 'success' as const,
              updatedAt: new Date().toISOString().slice(0, 19),
            }
          : d
      )
    );
  };

  const sendManagerMessage = () => {
    if (!qaFull) return;
    if (!selected || selected.status !== 'intercepted') return;
    const text = draft.trim();
    if (!text) return;

    const msg: QADialogueMessage = {
      id: `mgr-${Date.now()}`,
      date: new Date().toISOString().slice(0, 16).replace('T', ' '),
      sender: 'manager',
      content: text,
    };

    setDialogues((prev) =>
      prev.map((d) =>
        d.id === selected.id
          ? {
              ...d,
              messages: [...d.messages, msg],
              updatedAt: new Date().toISOString().slice(0, 19),
            }
          : d
      )
    );
    setDraft('');
  };

  const showComposer = qaFull && selected?.status === 'intercepted';

  return (
    <div className="flex flex-col md:flex-row flex-1 min-h-0 h-full min-w-0 font-sans">
      <div className="w-full md:w-[min(100%,340px)] md:max-w-[340px] md:shrink-0 flex flex-col border-b md:border-b-0 md:border-r border-[#1f1f22] bg-[#0a0a0c] max-h-[min(46vh,400px)] md:max-h-none min-h-0">
        <div className="p-4 border-b border-[#1f1f22] space-y-3">
          {outreachLetterPreview ? (
            <div className="rounded-xl border border-violet-500/35 bg-violet-950/25 px-3 py-3 text-[12px] space-y-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-200/95">
                Письмо из «Рассылки по базе»
              </p>
              <p className="text-[#a1a1aa]">
                {outreachLetterPreview.customerName}{' '}
                <span className="text-[#52525b]">·</span>{' '}
                <span className="font-mono text-[11px] text-[#71717a]">{outreachLetterPreview.email}</span>
              </p>
              <p className="text-sm font-medium text-white leading-snug">{outreachLetterPreview.subject}</p>
              <pre className="text-[11px] text-[#d4d4d8] whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto custom-scrollbar rounded-lg bg-[#0a0a0c] border border-[#1f1f22] p-2.5">
                {outreachLetterPreview.bodyText}
              </pre>
              <div className="flex flex-wrap gap-2 pt-0.5">
                <Link
                  href="/outreach"
                  className="inline-flex items-center text-[11px] font-semibold text-violet-300 hover:text-violet-200"
                >
                  ← К рассылке
                </Link>
                <button
                  type="button"
                  onClick={() => setOutreachLetterPreview(null)}
                  className="text-[11px] font-medium text-[#71717a] hover:text-zinc-300"
                >
                  Скрыть
                </button>
              </div>
            </div>
          ) : null}
          {!qaFull && subscription ? (
            <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100/90 leading-snug">
              Пробный тариф: просмотр диалогов без перехвата.{' '}
              <Link href="/billing" className="text-amber-200 underline underline-offset-2">
                Повысить тариф
              </Link>
            </div>
          ) : null}
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-white">Диалоги ИИ</h2>
              <p className="text-xs text-[#a1a1aa] mt-0.5">
                Показано {filtered.length} из {dialogues.length}
              </p>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 bg-[#f59e0b]/10 border border-[#f59e0b]/20 text-[#f59e0b] rounded text-[10px] font-semibold whitespace-nowrap">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#f59e0b] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#f59e0b]" />
              </span>
              {needAttentionCount} внимание
            </div>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-500" />
            <input
              type="search"
              placeholder="Поиск по клиенту и тексту…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#121214] border border-[#1f1f22] text-sm text-zinc-200 rounded-lg pl-9 pr-4 py-2 focus:outline-none focus:border-[#3b82f6]/50"
            />
          </div>

          <div className="flex gap-2 min-w-0">
            <NativeSelect
              variant="filter"
              className="flex-1 min-w-0"
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value as QAChannel | 'all')}
              aria-label="Фильтр по каналу"
            >
              <option value="all">Все каналы</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="telegram">Telegram</option>
              <option value="sms">SMS</option>
              <option value="email">Email</option>
              <option value="support">Поддержка</option>
            </NativeSelect>
            <NativeSelect
              variant="filter"
              className="flex-1 min-w-0"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as QAStatusFilter)}
              aria-label="Фильтр по статусу"
            >
              <option value="all">Все статусы</option>
              <option value="needs_attention">Нужен ответ / риск</option>
              <option value="warning">Требует внимания</option>
              <option value="intercepted">Перехвачен</option>
              <option value="active">В диалоге</option>
              <option value="success">Успешно</option>
            </NativeSelect>
          </div>

          <p className="text-[10px] text-[#52525b] flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1 rounded bg-[#1f1f22] font-mono">J</kbd>/
              <kbd className="px-1 rounded bg-[#1f1f22] font-mono">↓</kbd> вниз
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1 rounded bg-[#1f1f22] font-mono">K</kbd>/
              <kbd className="px-1 rounded bg-[#1f1f22] font-mono">↑</kbd> вверх
            </span>
          </p>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
          {filtered.length === 0 ? (
            <div className="text-center py-10 text-sm text-zinc-500 px-4">Ничего не найдено</div>
          ) : (
            filtered.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setSelectedId(d.id)}
                className={cn(
                  'w-full p-3 text-left border-b border-[#1f1f22]/50 transition-colors',
                  selectedId === d.id
                    ? 'bg-[#1f1f22] border-l-2 border-l-[#3b82f6]'
                    : 'hover:bg-[#121214] border-l-2 border-l-transparent'
                )}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-medium text-[14px] text-white truncate flex items-center gap-1.5 min-w-0">
                    {threadNeedsAttention(d) && d.status === 'active' ? (
                      <span
                        className="shrink-0 w-1.5 h-1.5 rounded-full bg-amber-400"
                        title="Последнее сообщение от клиента или сработали маркеры риска"
                      />
                    ) : null}
                    {d.client}
                  </span>
                  <span
                    className="text-[9px] font-mono border border-[#1f1f22] bg-[#121214] px-1.5 py-0.5 rounded shrink-0"
                    style={{ color: statusColor(d.status) }}
                  >
                    {STATUS_LABEL[d.status]}
                  </span>
                </div>
                <div className="text-[11px] text-[#71717a] truncate">{CHANNEL_LABEL[d.channel]}</div>
              </button>
            ))
          )}
        </div>

        <div className="p-2 border-t border-[#1f1f22] flex justify-center gap-1">
          <button
            type="button"
            onClick={() => navigateList(-1)}
            className="p-2 rounded-lg hover:bg-[#121214] text-[#71717a] hover:text-white"
            title="Предыдущий"
          >
            <ChevronUp className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => navigateList(1)}
            className="p-2 rounded-lg hover:bg-[#121214] text-[#71717a] hover:text-white"
            title="Следующий"
          >
            <ChevronDown className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-[#0a0a0c] overflow-hidden">
        {selected ? (
          <>
            <div className="shrink-0 border-b border-[#1f1f22] px-4 sm:px-6 lg:px-8 py-4 sm:py-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex items-start gap-4">
                <div
                  className="w-12 h-12 rounded-full bg-[#121214] border border-[#1f1f22] flex items-center justify-center text-sm font-bold text-white"
                  style={{ boxShadow: `0 0 0 1px ${statusColor(selected.status)}40` }}
                >
                  {selected.clientInitials}
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-xl font-semibold text-white text-balance break-words">
                    {selected.client}
                  </h1>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="text-[11px] font-mono border border-[#1f1f22] bg-[#121214] px-2 py-0.5 rounded text-[#a1a1aa]">
                      {CHANNEL_LABEL[selected.channel]}
                    </span>
                    <span
                      className="text-[11px] font-semibold px-2 py-0.5 rounded border"
                      style={{
                        color: statusColor(selected.status),
                        borderColor: `${statusColor(selected.status)}40`,
                        background: `${statusColor(selected.status)}14`,
                      }}
                    >
                      {STATUS_LABEL[selected.status]}
                    </span>
                    <span className="text-[11px] text-[#52525b]">
                      Обновлено {selected.updatedAt.replace('T', ' ').slice(0, 16)}
                    </span>
                  </div>
                  <p className="text-sm text-[#a1a1aa] mt-3 max-w-2xl">{selected.issue}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                {(selected.status === 'warning' || selected.status === 'active') &&
                  selected.channel !== 'support' && (
                  <button
                    type="button"
                    onClick={() => intercept(selected.id)}
                    disabled={!qaFull}
                    title={
                      !qaFull
                        ? 'Доступно с тарифа Starter (полный QA)'
                        : 'Перехватить диалог для ответа менеджера'
                    }
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#3b82f6]/15 text-[#3b82f6] border border-[#3b82f6]/30 hover:bg-[#3b82f6]/25 rounded-lg text-sm font-semibold disabled:opacity-40 disabled:pointer-events-none"
                  >
                    <Hand className="w-4 h-4" />
                    Перехватить диалог
                  </button>
                )}
                {selected.status !== 'success' && (
                  <button
                    type="button"
                    onClick={() => markResolved(selected.id)}
                    className="inline-flex items-center gap-2 px-4 py-2 border border-[#1f1f22] text-[#d4d4d8] hover:bg-[#121214] rounded-lg text-sm font-medium"
                  >
                    <CheckCircle className="w-4 h-4 text-[#10b981]" />
                    Закрыть как решено
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar px-4 sm:px-6 lg:px-8 py-4 sm:py-6 min-h-0">
              {selected.managerNote && (
                <div className="mb-6 flex items-start gap-3 rounded-lg border border-[#3b82f6]/30 bg-[#3b82f6]/10 px-4 py-3 text-sm text-[#93c5fd]">
                  <Shield className="w-5 h-5 shrink-0 mt-0.5" />
                  <span>{selected.managerNote}</span>
                </div>
              )}

              <div className="space-y-4 max-w-3xl pb-4">
                {selected.messages.map((m) => (
                  <Fragment key={m.id}>
                    <MessageBubble m={m} />
                  </Fragment>
                ))}
              </div>
            </div>

            {showComposer && (
              <div className="shrink-0 border-t border-[#1f1f22] bg-[#0a0a0c] px-4 sm:px-6 lg:px-8 py-4">
                <div className="max-w-3xl flex flex-col gap-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs text-[#71717a]">
                      <UserCircle2 className="w-4 h-4 text-[#3b82f6]" />
                      <span>
                        Ответ менеджера в {CHANNEL_LABEL[selected.channel]} (после перехвата; в проде уйдёт в API
                        канала)
                      </span>
                    </div>
                    <label className="inline-flex items-center gap-2 text-[11px] text-[#a1a1aa] cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={autoSuggestOnIntercept}
                        onChange={(e) => setAutoSuggestPreference(e.target.checked)}
                        className="rounded border-[#3f3f46] bg-[#121214] text-[#8b5cf6] focus:ring-[#8b5cf6]/40"
                      />
                      Автоподсказка ИИ при перехвате
                    </label>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault();
                          sendManagerMessage();
                        }
                      }}
                      placeholder="Напишите сообщение клиенту… (Ctrl+Enter или ⌘+Enter — отправить)"
                      rows={3}
                      disabled={suggestLoading}
                      className="flex-1 bg-[#121214] border border-[#1f1f22] rounded-xl px-4 py-3 text-sm text-[#e4e4e7] placeholder:text-[#52525b] focus:outline-none focus:border-[#3b82f6]/50 resize-y min-h-[88px] disabled:opacity-60"
                    />
                    <div className="flex flex-col gap-2 self-end shrink-0">
                      <button
                        type="button"
                        onClick={() => void fillSuggestDraft(selected)}
                        disabled={!qaFull || suggestLoading}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[#8b5cf6]/35 text-[#c4b5fd] text-sm font-medium hover:bg-[#8b5cf6]/10 disabled:opacity-40 disabled:pointer-events-none"
                      >
                        {suggestLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Sparkles className="w-4 h-4" />
                        )}
                        Подсказка
                      </button>
                      <button
                        type="button"
                        onClick={sendManagerMessage}
                        disabled={!draft.trim() || suggestLoading}
                        className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#3b82f6] text-white text-sm font-semibold hover:bg-[#2563eb] disabled:opacity-40 disabled:pointer-events-none"
                      >
                        <Send className="w-4 h-4" />
                        Отправить
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[#71717a]">
            Выберите диалог слева
          </div>
        )}
      </div>
    </div>
  );
}

function MessageBubble({ m }: { m: QADialogueMessage }) {
  const isManager = m.sender === 'manager';
  return (
    <div
      className={cn(
        'rounded-xl border p-4',
        m.sender === 'ai' && 'border-[#8b5cf6]/25 bg-[#8b5cf6]/5',
        m.sender === 'client' && 'border-[#10b981]/25 bg-[#10b981]/5',
        m.sender === 'system' && 'border-[#3f3f46] bg-[#121214]',
        isManager && 'border-[#3b82f6]/35 bg-[#3b82f6]/10'
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[11px] font-mono text-[#71717a]">{m.date}</span>
        <span
          className={cn(
            'text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border',
            m.sender === 'ai' && 'bg-[#8b5cf6]/10 text-[#a78bfa] border-[#8b5cf6]/20',
            m.sender === 'client' && 'bg-[#10b981]/10 text-[#6ee7b7] border-[#10b981]/20',
            m.sender === 'system' && 'bg-[#27272a] text-[#a1a1aa] border-[#3f3f46]',
            isManager && 'bg-[#3b82f6]/15 text-[#93c5fd] border-[#3b82f6]/30'
          )}
        >
          {m.sender === 'ai'
            ? 'ИИ'
            : m.sender === 'client'
              ? 'Клиент'
              : m.sender === 'manager'
                ? 'Менеджер'
                : 'Система'}
        </span>
      </div>
      <p className="text-[14px] text-[#e4e4e7] leading-relaxed whitespace-pre-wrap">{m.content}</p>
    </div>
  );
}
