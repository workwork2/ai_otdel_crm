'use client';

import React from 'react';
import { Zap, CheckCircle2, Shield, ArrowRight, Sparkles, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSubscription } from '@/context/SubscriptionContext';

type BillingDto = {
  planKey?: string;
  planLabel: string;
  priceRubMonthly: number;
  validUntil: string;
  messagesUsed: number;
  messagesLimit: number;
  audienceUsed: number;
  audienceLimit: number;
  invoices: Array<{ date: string; doc: string; amountRub: number; status: string }>;
};

const FALLBACK: BillingDto = {
  planLabel: '—',
  priceRubMonthly: 0,
  validUntil: '',
  messagesUsed: 0,
  messagesLimit: 1,
  audienceUsed: 0,
  audienceLimit: 1,
  invoices: [],
};

function pct(used: number, limit: number) {
  if (!limit) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

const PLAN_OPTIONS: {
  id: string;
  title: string;
  blurb: string;
  highlight?: boolean;
}[] = [
  { id: 'trial', title: 'Trial', blurb: 'Пробный период: базовые сценарии, без QA и расширенной аналитики.' },
  { id: 'starter', title: 'Starter', blurb: 'Полные диалоги, интеграции, ИИ-тексты, отчёты базового уровня.' },
  {
    id: 'business_plus',
    title: 'Business Plus',
    blurb: 'Расширенная аналитика, больше активных сценариев.',
    highlight: true,
  },
  { id: 'pro', title: 'Pro', blurb: 'Канал MAX (VK), приоритет, максимум возможностей в стандартной линейке.' },
  { id: 'enterprise', title: 'Enterprise', blurb: 'Индивидуальные лимиты и договор — для показа доступен как демо-переключатель.' },
];

export function Billing() {
  const { subscription, loading, setPlan, refresh } = useSubscription();
  const [changing, setChanging] = React.useState<string | null>(null);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const b: BillingDto = subscription?.billing
    ? { ...subscription.billing, planKey: subscription.planKey }
    : FALLBACK;

  const ent = subscription?.entitlements;

  const validLabel = (() => {
    try {
      const d = new Date(b.validUntil);
      if (!Number.isNaN(d.getTime())) {
        return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
      }
    } catch {
      /* ignore */
    }
    return b.validUntil || '—';
  })();

  const onPickPlan = async (id: string) => {
    setChanging(id);
    try {
      await setPlan(id);
    } finally {
      setChanging(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-10 py-10 space-y-8 custom-scrollbar fade-in">
      <div>
        <h1 className="text-3xl font-semibold text-white tracking-tight">Мой тариф</h1>
        <p className="text-[#a1a1aa] mt-2">
          Лимиты и возможности синхронизируются с сервером. Для показа можно мгновенно сменить тариф (демо).
        </p>
        {loading && !subscription ? (
          <p className="text-xs text-[#71717a] mt-2 flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Загрузка подписки…
          </p>
        ) : null}
      </div>

      <section
        id="plan-picker"
        className="crm-panel p-6 space-y-4 border border-violet-500/20 bg-violet-950/10 scroll-mt-24"
      >
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-violet-400">
          <Sparkles className="w-4 h-4" />
          Сменить тариф (демо для показа)
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {PLAN_OPTIONS.map((p) => {
            const current = b.planKey === p.id || subscription?.planKey === p.id;
            return (
              <button
                key={p.id}
                type="button"
                disabled={!!changing}
                onClick={() => void onPickPlan(p.id)}
                className={cn(
                  'text-left rounded-xl border p-4 transition-colors disabled:opacity-50',
                  current
                    ? 'border-violet-500/50 bg-violet-500/10'
                    : 'border-[#27272a] bg-[#121214] hover:border-zinc-600',
                  p.highlight && !current && 'border-amber-500/25'
                )}
              >
                <div className="text-sm font-semibold text-white flex items-center justify-between gap-2">
                  {p.title}
                  {changing === p.id ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : null}
                </div>
                <p className="text-[11px] text-[#a1a1aa] mt-2 leading-snug">{p.blurb}</p>
                {current ? (
                  <span className="inline-block mt-3 text-[10px] font-bold text-violet-300 uppercase">
                    Текущий
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </section>

      {ent ? (
        <div className="crm-card p-5 border border-[#27272a]">
          <h3 className="text-sm font-medium text-white mb-3">Возможности на этом тарифе</h3>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[#a1a1aa]">
            <li className={ent.excelImport ? 'text-emerald-400' : 'text-red-400/90'}>
              {ent.excelImport ? '✓' : '✗'} Импорт Excel
            </li>
            <li className={ent.qaFullAccess ? 'text-emerald-400' : 'text-red-400/90'}>
              {ent.qaFullAccess ? '✓' : '✗'} Полный QA (перехват диалогов)
            </li>
            <li className={ent.analyticsAdvanced ? 'text-emerald-400' : 'text-red-400/90'}>
              {ent.analyticsAdvanced ? '✓' : '✗'} Расширенная аналитика
            </li>
            <li className={ent.aiRefineCopy ? 'text-emerald-400' : 'text-red-400/90'}>
              {ent.aiRefineCopy ? '✓' : '✗'} ИИ-доработка текстов
            </li>
            <li className={ent.integrationsManage ? 'text-emerald-400' : 'text-red-400/90'}>
              {ent.integrationsManage ? '✓' : '✗'} Управление интеграциями
            </li>
            <li className={ent.maxChannel ? 'text-emerald-400' : 'text-red-400/90'}>
              {ent.maxChannel ? '✓' : '✗'} Канал MAX (VK)
            </li>
            <li className="text-[#71717a]">
              Активных сценариев до:{' '}
              <span className="text-white font-mono">{ent.maxActiveAutomations}</span>
            </li>
          </ul>
        </div>
      ) : null}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <div className="crm-panel p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <Zap className="w-40 h-40 text-purple-500" />
            </div>

            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <span className="px-3 py-1 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-md text-xs font-bold uppercase tracking-wider">
                  {b.planLabel}
                </span>
                <span className="text-sm text-[#71717a]">Активен до {validLabel}</span>
              </div>

              <div className="text-5xl font-bold text-white mb-2">
                ₽ {b.priceRubMonthly.toLocaleString('ru-RU')}{' '}
                <span className="text-xl text-[#71717a] font-normal">/ мес</span>
              </div>

              <div className="mt-8 space-y-4 max-w-md">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[#d4d4d8]">Отправлено сообщений (лимит)</span>
                  <span className="font-mono text-purple-400">
                    {b.messagesUsed.toLocaleString('ru-RU')} / {b.messagesLimit.toLocaleString('ru-RU')}
                  </span>
                </div>
                <div className="w-full bg-[#1f1f22] rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-purple-500 h-2 rounded-full"
                    style={{ width: `${pct(b.messagesUsed, b.messagesLimit)}%` }}
                  />
                </div>

                <div className="flex justify-between items-center text-sm pt-4">
                  <span className="text-[#d4d4d8]">Размер базы клиентов</span>
                  <span className="font-mono text-blue-400">
                    {b.audienceUsed.toLocaleString('ru-RU')} / {b.audienceLimit.toLocaleString('ru-RU')}
                  </span>
                </div>
                <div className="w-full bg-[#1f1f22] rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-blue-500 h-2 rounded-full"
                    style={{ width: `${pct(b.audienceUsed, b.audienceLimit)}%` }}
                  />
                </div>
              </div>

              <div className="mt-10 flex gap-4">
                <button
                  type="button"
                  className="px-6 py-2.5 bg-white text-black font-semibold rounded-lg text-sm hover:bg-[#d4d4d8] transition-colors"
                  onClick={() => document.getElementById('plan-picker')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  Повысить тариф
                </button>
                <button
                  type="button"
                  className="px-6 py-2.5 bg-transparent border border-[#1f1f22] text-[#d4d4d8] font-medium rounded-lg text-sm hover:bg-[#121214] transition-colors"
                >
                  Скачать чеки
                </button>
              </div>
            </div>
          </div>

          <div className="pt-8">
            <h3 className="text-md font-medium text-white mb-4">История платежей</h3>
            {b.invoices.length === 0 ? (
              <p className="text-sm text-[#71717a]">На пробном тарифе счета появятся после оплаты.</p>
            ) : (
              <table className="w-full text-left text-sm text-[#d4d4d8]">
                <thead className="border-b border-[#1f1f22] text-[11px] text-[#a1a1aa] uppercase tracking-wider">
                  <tr>
                    <th className="py-3 font-normal">Дата</th>
                    <th className="py-3 font-normal">Документ</th>
                    <th className="py-3 font-normal">Сумма</th>
                    <th className="py-3 font-normal">Статус</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1f1f22] text-xs">
                  {b.invoices.map((inv, i) => (
                    <tr key={`${inv.doc}-${i}`}>
                      <td className="py-4">{inv.date}</td>
                      <td className="py-4 text-blue-400 underline cursor-pointer">{inv.doc}</td>
                      <td className="py-4">₽ {inv.amountRub.toLocaleString('ru-RU')}</td>
                      <td className="py-4">
                        <span className="text-[#10b981] flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> {inv.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div>
          <div className="crm-card border-[#3b82f6]/30 bg-[#121214] p-6 relative">
            <h3 className="text-lg font-semibold text-white mb-2">Безлимитный вариант</h3>
            <p className="text-xs text-[#a1a1aa] mb-6">
              On-Premise и выделенный контур — обсуждается отдельно после Enterprise.
            </p>

            <ul className="space-y-4 mb-8">
              <li className="flex items-start gap-3 text-sm text-[#d4d4d8]">
                <Shield className="w-5 h-5 text-[#3b82f6] shrink-0" />
                <span>Физически изолированный сервер</span>
              </li>
              <li className="flex items-start gap-3 text-sm text-[#d4d4d8]">
                <Zap className="w-5 h-5 text-[#3b82f6] shrink-0" />
                <span>Мгновенная работа без ограничений</span>
              </li>
              <li className="flex items-start gap-3 text-sm text-[#d4d4d8]">
                <CheckCircle2 className="w-5 h-5 text-[#3b82f6] shrink-0" />
                <span>Безлимитные сообщения</span>
              </li>
            </ul>

            <button
              type="button"
              onClick={() => void onPickPlan('enterprise')}
              disabled={!!changing}
              className="w-full flex items-center justify-center gap-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white font-semibold py-3 rounded-lg transition-colors shadow-[0_0_20px_rgba(59,130,246,0.3)] disabled:opacity-50"
            >
              Демо: Enterprise <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
