'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts';
import {
  ArrowUpRight,
  Filter,
  TrendingUp,
  Target,
  PiggyBank,
  Shield,
  Sparkles,
  Loader2,
  Users,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAudienceData } from '@/context/AudienceDataContext';
import {
  computeEESMetrics,
  formatRub,
  churnTrendFromClients,
  lifecycleFunnelFromClients,
  purchaseTotalsByMonth,
} from '@/lib/eesMetrics';
import { useSubscription } from '@/context/SubscriptionContext';
import { ClientMount } from '@/components/ClientMount';
import { getApiBaseUrl, getTenantIdClient, jsonTenantHeaders } from '@/lib/backend-api';
import { NativeSelect } from '@/components/ui/NativeSelect';

type ReportPeriod = 'apr2026' | 'last30' | 'last7' | 'q1';

const PERIOD_OPTIONS: { id: ReportPeriod; label: string }[] = [
  { id: 'apr2026', label: 'Апрель 2026 (полный)' },
  { id: 'last30', label: 'Последние 30 дней' },
  { id: 'last7', label: 'Последние 7 дней' },
  { id: 'q1', label: 'Q1 2026 (агрегат)' },
];

export function Analytics() {
  const [period, setPeriod] = useState<ReportPeriod>('apr2026');
  const { clients } = useAudienceData();
  const { has, subscription } = useSubscription();
  const apiOn = !!getApiBaseUrl();
  const advanced = !subscription || has('analyticsAdvanced');
  const ees = useMemo(() => computeEESMetrics(clients), [clients]);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const runAiReport = async () => {
    const base = getApiBaseUrl();
    const tenantId = getTenantIdClient().trim();
    if (!base || !tenantId) {
      setAiError('Войдите в панель и убедитесь, что API доступен.');
      return;
    }
    if (!has('aiRefineCopy')) {
      setAiError('ИИ-отчёт доступен с тарифа Starter и выше.');
      return;
    }
    setAiLoading(true);
    setAiError(null);
    setAiReport(null);
    try {
      const r = await fetch(`${base}/v1/tenant/${encodeURIComponent(tenantId)}/ai/analytics-report`, {
        method: 'POST',
        headers: jsonTenantHeaders(),
      });
      const data = (await r.json().catch(() => ({}))) as { text?: string; message?: string | string[] };
      if (!r.ok) {
        const msg = Array.isArray(data.message) ? data.message.join(', ') : data.message;
        setAiError(msg || `Ошибка ${r.status}`);
        return;
      }
      setAiReport(data.text ?? '');
    } catch {
      setAiError('Сеть или API недоступен.');
    } finally {
      setAiLoading(false);
    }
  };

  const purchaseFullSeries = useMemo(() => purchaseTotalsByMonth(clients, 12), [clients]);

  const purchaseChartData = useMemo(() => {
    const rows = purchaseFullSeries;
    if (period === 'apr2026') {
      return rows.filter((r) => r.key === '2026-04');
    }
    if (period === 'last7') {
      return rows.slice(-1);
    }
    if (period === 'last30') {
      return rows.slice(-2);
    }
    if (period === 'q1') {
      return rows.filter((r) => /^2026-0[1-3]$/.test(r.key));
    }
    return rows;
  }, [purchaseFullSeries, period]);

  const churnChartData = useMemo(() => churnTrendFromClients(clients), [clients]);

  const funnelFromBase = useMemo(() => lifecycleFunnelFromClients(clients), [clients]);

  const purchasesChartEmpty =
    clients.length === 0 ||
    purchaseChartData.length === 0 ||
    purchaseChartData.every((r) => r.value === 0);

  const churnChartEmpty = churnChartData.length === 0;

  const funnelEmpty = funnelFromBase.length === 0;

  return (
    <div className="crm-page crm-page--std custom-scrollbar space-y-6 sm:space-y-8 fade-in">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
        <div className="min-w-0 flex-1">
          <div className="crm-page-eyebrow">
            <Sparkles className="w-4 h-4 text-[#8b5cf6]" />
            EES · аналитика
          </div>
          <h1 className="crm-page-h1 text-balance">Аналитика</h1>
          <p className="crm-page-lead max-w-2xl">
            Цифры и графики — по текущей базе клиентов и диалогам QA. Данные подтягиваются из раздела{' '}
            <Link href="/clients" className="text-violet-400 underline underline-offset-2 hover:text-violet-300">
              Клиенты
            </Link>{' '}
            (CRM, импорт или API). Период задаёт окно для графика покупок.
          </p>

          <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-5xl">
            <div className="crm-panel p-5 border border-violet-500/25 bg-violet-950/15">
              <div className="flex items-center gap-2 text-violet-200 text-sm font-semibold mb-2">
                <Users className="w-4 h-4 shrink-0" />
                Данные для отчётов
              </div>
              <p className="text-sm text-[#a1a1aa] leading-relaxed mb-4">
                Сейчас в базе: <span className="text-white font-medium tabular-nums">{clients.length}</span>{' '}
                контактов. Редактируйте аудиторию в разделе «Клиенты» — графики обновятся автоматически.
              </p>
              <Link
                href="/clients"
                className="inline-flex items-center gap-2 rounded-lg bg-violet-600/90 text-white text-sm font-medium px-4 py-2.5 hover:bg-violet-500 transition-colors"
              >
                Открыть клиентов
              </Link>
            </div>

            <div className="crm-panel p-5 border border-amber-500/25 bg-amber-950/15">
              <div className="flex items-center gap-2 text-amber-200 text-sm font-semibold mb-2">
                <FileText className="w-4 h-4 shrink-0" />
                ИИ-сводка
              </div>
              <p className="text-sm text-[#a1a1aa] leading-relaxed mb-4">
                Текстовый отчёт по агрегатам базы и QA. На API нужен{' '}
                <code className="text-[11px] text-zinc-400">GEMINI_API_KEY</code> и/или{' '}
                <code className="text-[11px] text-zinc-400">ANTHROPIC_API_KEY</code> (см.{' '}
                <code className="text-[11px] text-zinc-400">AI_PRIMARY_PROVIDER</code>).
              </p>
              <button
                type="button"
                disabled={aiLoading || !has('aiRefineCopy')}
                onClick={() => void runAiReport()}
                className={cn(
                  'inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium',
                  has('aiRefineCopy')
                    ? 'bg-amber-600/90 text-white hover:bg-amber-500'
                    : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                )}
              >
                {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Сгенерировать отчёт
              </button>
              {!has('aiRefineCopy') ? (
                <p className="text-xs text-amber-200/80 mt-2">
                  Доступно с тарифа Starter.{' '}
                  <Link href="/billing" className="underline underline-offset-2">
                    Тарифы
                  </Link>
                </p>
              ) : null}
              {aiError ? <p className="text-xs text-red-400 mt-3 leading-snug">{aiError}</p> : null}
            </div>
          </div>

          {aiReport ? (
            <div className="mt-6 crm-panel p-5 sm:p-6 border border-zinc-700/80 max-w-5xl">
              <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-400" />
                Результат анализа
              </h2>
              <div className="prose prose-invert prose-sm max-w-none text-[#d4d4d8] leading-relaxed whitespace-pre-wrap">
                {aiReport}
              </div>
            </div>
          ) : null}

          {!advanced && subscription ? (
            <p className="mt-3 text-sm text-amber-200/90 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 max-w-2xl">
              Расширенные графики и воронка доступны с тарифа Business Plus. Сводные KPI ниже — всегда.{' '}
              <Link href="/billing" className="text-amber-200 underline underline-offset-2">
                Повысить тариф
              </Link>
            </p>
          ) : null}
        </div>
        <label className="flex items-center gap-2 border border-[#1f1f22] bg-[#121214] text-[#d4d4d8] px-3 sm:px-4 py-2 rounded-lg text-sm hover:bg-[#1f1f22] transition-colors cursor-pointer shrink-0 min-w-0 w-full sm:w-auto max-w-full sm:max-w-[min(100%,280px)]">
          <Filter className="w-4 h-4 shrink-0 text-zinc-500" />
          <NativeSelect
            variant="bare"
            className="min-w-0 flex-1"
            selectClassName="max-w-full"
            value={period}
            onChange={(e) => setPeriod(e.target.value as ReportPeriod)}
            aria-label="Период отчёта"
          >
            {PERIOD_OPTIONS.map((o) => (
              <option key={o.id} value={o.id} className="bg-[#121214] text-[#e4e4e7]">
                {o.label}
              </option>
            ))}
          </NativeSelect>
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AnalyticCard
          title="Сгенерированная выручка (30д)"
          value={formatRub(ees.generatedRevenueMonthRub)}
          trend="атрибуция к ИИ"
          isPositive
          icon={<TrendingUp className="w-5 h-5 text-[#10b981]" />}
        />
        <AnalyticCard
          title="Спасённые деньги"
          value={formatRub(ees.savedMoneyRub)}
          trend="без лишних скидок"
          isPositive
          icon={<PiggyBank className="w-5 h-5 text-[#22d3ee]" />}
        />
        <AnalyticCard
          title="Возврат из зоны риска"
          value={`${ees.churnRiskReturnedCount} чел.`}
          trend={`охват риска: ${ees.churnRiskContactedCount}`}
          isPositive
          icon={<Shield className="w-5 h-5 text-[#f59e0b]" />}
        />
      </div>

      {advanced ? (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="crm-panel p-6">
          <h3 className="text-[15px] font-medium text-white mb-2 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#10b981]" /> Суммы покупок по месяцам
          </h3>
          <p className="text-xs text-[#71717a] mb-4">
            Только поле <span className="text-zinc-400">purchases[].date</span> и <span className="text-zinc-400">price</span> в загруженных клиентах. Разбивки «ИИ vs органика» в данных нет — одна честная серия.
          </p>
          <div className="h-[280px] min-w-0 w-full">
            {purchasesChartEmpty ? (
              <div className="h-full flex items-center justify-center rounded-lg border border-dashed border-zinc-700 bg-zinc-900/40 px-4 text-center text-sm text-[#a1a1aa]">
                {clients.length === 0
                  ? 'Добавьте клиентов в разделе «Клиенты», чтобы увидеть динамику покупок.'
                  : 'Нет сумм покупок с датами в выбранном окне периода — проверьте поля покупок в данных.'}
              </div>
            ) : (
            <ClientMount minHeight={280}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <AreaChart data={purchaseChartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPurchases" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f1f22" vertical={false} />
                <XAxis dataKey="name" stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis
                  stroke="#71717a"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => formatRubAxis(value)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#121214',
                    border: '1px solid #1f1f22',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#d4d4d8',
                  }}
                  formatter={(v) => [formatRub(Number(v)), 'Сумма']}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="value"
                  name="Покупки"
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorPurchases)"
                />
              </AreaChart>
            </ResponsiveContainer>
            </ClientMount>
            )}
          </div>
        </div>

        <div className="crm-panel p-6">
          <h3 className="text-[15px] font-medium text-white mb-2 flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#f59e0b]" /> Churn prevention: риск → возврат
          </h3>
          <p className="text-xs text-[#71717a] mb-4">
            Агрегат по текущей базе: сегменты скоринга и lifecycle (без выдуманных недельных рядов).
          </p>
          <div className="h-[280px] min-w-0 w-full">
            {churnChartEmpty ? (
              <div className="h-full flex items-center justify-center rounded-lg border border-dashed border-zinc-700 bg-zinc-900/40 px-4 text-center text-sm text-[#a1a1aa]">
                Нет клиентов в базе — нечего показывать по удержанию.
              </div>
            ) : (
            <ClientMount minHeight={280}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={churnChartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f1f22" vertical={false} />
                <XAxis dataKey="week" stroke="#71717a" fontSize={11} />
                <YAxis stroke="#71717a" fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#121214',
                    border: '1px solid #1f1f22',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#fff',
                  }}
                />
                <Legend />
                <Bar dataKey="returned" name="Вернулись к покупке" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="inRisk" name="В зоне риска (охват)" fill="#3f3f46" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            </ClientMount>
            )}
          </div>
        </div>
      </div>
      ) : (
        <div className="crm-panel p-6 border border-dashed border-zinc-600">
          <p className="text-sm text-[#a1a1aa] leading-relaxed">
            Детальная динамика выручки, удержание по неделям и воронка ИИ включены в тарифе{' '}
            <span className="text-zinc-300">Business Plus</span> и выше. Сводные показатели вверху страницы
            доступны всегда.
          </p>
        </div>
      )}

      {advanced ? (
      <div className="crm-panel p-6">
        <h3 className="text-[15px] font-medium text-white mb-2 flex items-center gap-2">
          <Target className="w-4 h-4 text-[#8b5cf6]" /> Распределение по этапу lifecycle
        </h3>
        <p className="text-xs text-[#71717a] mb-4">
          Считается только для клиентов с заполненным <span className="text-zinc-400">scoring.lifecycle</span> в базе.
        </p>
        <div className="h-[300px] min-w-0 w-full">
          {funnelEmpty ? (
            <div className="h-full min-h-[240px] flex items-center justify-center rounded-lg border border-dashed border-zinc-700 bg-zinc-900/40 px-4 text-center text-sm text-[#a1a1aa]">
              {clients.length === 0
                ? 'После импорта и скоринга здесь появятся этапы lifecycle.'
                : 'В базе нет клиентов с полем lifecycle в скоринге — воронка не строится.'}
            </div>
          ) : (
          <ClientMount minHeight={300}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart layout="vertical" data={funnelFromBase} margin={{ top: 0, right: 0, left: 30, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f1f22" horizontal={false} />
              <XAxis type="number" stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} hide />
              <YAxis
                dataKey="name"
                type="category"
                stroke="#d4d4d8"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={130}
              />
              <Tooltip
                cursor={{ fill: '#1f1f22', opacity: 0.4 }}
                contentStyle={{
                  backgroundColor: '#121214',
                  border: '1px solid #1f1f22',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: '#fff',
                }}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                {funnelFromBase.map((_, index) => (
                  <Cell key={`c-${index}`} fill={`rgba(139, 92, 246, ${1 - index * 0.12})`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          </ClientMount>
          )}
        </div>
      </div>
      ) : null}
    </div>
  );
}

function formatRubAxis(n: number): string {
  if (n >= 1_000_000) return `₽${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `₽${(n / 1000).toFixed(0)}k`;
  return `₽${Math.round(n)}`;
}

function AnalyticCard({
  title,
  value,
  trend,
  isPositive,
  icon,
}: {
  title: string;
  value: string;
  trend: string;
  isPositive: boolean;
  icon: React.ReactNode;
}) {
  return (
    <div className="crm-card p-5">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="text-[11px] text-[#a1a1aa] uppercase tracking-wider">{title}</div>
        <div className="text-[#71717a]">{icon}</div>
      </div>
      <div className="flex items-end gap-3 flex-wrap">
        <div className="text-2xl font-bold text-white">{value}</div>
        <div
          className={cn(
            'flex items-center text-xs font-semibold pb-1',
            isPositive ? 'text-[#10b981]' : 'text-red-500'
          )}
        >
          <ArrowUpRight className="w-3 h-3 mr-0.5" />
          {trend}
        </div>
      </div>
    </div>
  );
}
