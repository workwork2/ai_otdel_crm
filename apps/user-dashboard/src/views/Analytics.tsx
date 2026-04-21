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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAudienceData } from '@/context/AudienceDataContext';
import { computeEESMetrics, formatRub, churnPreventionTrend } from '@/lib/eesMetrics';
import { useSubscription } from '@/context/SubscriptionContext';
import { ClientMount } from '@/components/ClientMount';

const funnelData = [
  { name: 'Сигналы из CRM/Кассы', value: 14500 },
  { name: 'Сгенерировано офферов', value: 12200 },
  { name: 'Прочитано', value: 8900 },
  { name: 'Начат диалог', value: 3400 },
  { name: 'Целевое действие', value: 1850 },
  { name: 'Успешная продажа', value: 1620 },
];

const revenueData = [
  { name: '01.04', ai: 520000, manual: 720000 },
  { name: '05.04', ai: 680000, manual: 690000 },
  { name: '10.04', ai: 910000, manual: 640000 },
  { name: '15.04', ai: 1240000, manual: 580000 },
  { name: '20.04', ai: 1580000, manual: 520000 },
];

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
  const advanced = !subscription || has('analyticsAdvanced');
  const ees = useMemo(() => computeEESMetrics(clients), [clients]);

  const periodFactor = useMemo(() => {
    switch (period) {
      case 'last7':
        return 0.22;
      case 'last30':
        return 0.85;
      case 'q1':
        return 2.65;
      default:
        return 1;
    }
  }, [period]);

  const eesScaled = useMemo(() => {
    const revF = periodFactor;
    const churnF =
      period === 'q1'
        ? 1.35
        : period === 'last7'
          ? 0.35
          : period === 'last30'
            ? 0.88
            : 1;
    const returned = Math.max(1, Math.round(ees.churnRiskReturnedCount * churnF));
    const contacted = Math.max(returned, Math.round(ees.churnRiskContactedCount * churnF));
    return {
      generatedRevenueMonthRub: Math.round(ees.generatedRevenueMonthRub * revF),
      savedMoneyRub: Math.round(ees.savedMoneyRub * revF),
      churnRiskReturnedCount: returned,
      churnRiskContactedCount: contacted,
    };
  }, [ees, period, periodFactor]);

  const revenueFiltered = useMemo(() => {
    if (period === 'last7') return revenueData.slice(-2);
    if (period === 'last30') return revenueData.slice(-4);
    if (period === 'q1') {
      const sum = revenueData.reduce(
        (acc, row) => ({ ai: acc.ai + row.ai, manual: acc.manual + row.manual }),
        { ai: 0, manual: 0 }
      );
      return [{ name: 'Q1', ai: sum.ai, manual: sum.manual }];
    }
    return revenueData;
  }, [period]);

  const churnWeeks = useMemo(() => {
    const base = churnPreventionTrend();
    if (period === 'last7') return base.slice(0, 1);
    if (period === 'last30') return base;
    if (period === 'q1')
      return [
        ...base,
        { week: 'Нед 5', returned: 28, inRisk: 42 },
        { week: 'Нед 6', returned: 22, inRisk: 45 },
      ];
    return base;
  }, [period]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto w-full max-w-6xl mx-auto px-4 sm:px-8 lg:px-10 py-8 sm:py-10 space-y-8 fade-in">
      <div className="flex justify-between items-end flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-[#71717a] font-semibold mb-2">
            <Sparkles className="w-4 h-4 text-[#8b5cf6]" />
            EES · отчётность
          </div>
          <h1 className="text-3xl font-semibold text-white tracking-tight">Аналитика</h1>
          <p className="text-[#a1a1aa] mt-2 text-[15px] max-w-2xl">
            Главная цифра месяца — сгенерированная выручка после касаний ИИ; рядом — экономия на скидках и
            удержание «зоны риска».
          </p>
          {!advanced && subscription ? (
            <p className="mt-3 text-sm text-amber-200/90 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 max-w-2xl">
              Расширенные графики и воронка доступны с тарифа Business Plus. Сводные KPI ниже — всегда.{' '}
              <Link href="/billing" className="text-amber-200 underline underline-offset-2">
                Повысить тариф
              </Link>
            </p>
          ) : null}
        </div>
        <label className="flex items-center gap-2 border border-[#1f1f22] bg-[#121214] text-[#d4d4d8] px-3 sm:px-4 py-2 rounded-lg text-sm hover:bg-[#1f1f22] transition-colors cursor-pointer shrink-0">
          <Filter className="w-4 h-4 shrink-0" />
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as ReportPeriod)}
            className="bg-transparent border-none outline-none text-[#d4d4d8] text-sm font-medium cursor-pointer max-w-[min(100vw-8rem,220px)]"
            aria-label="Период отчёта"
          >
            {PERIOD_OPTIONS.map((o) => (
              <option key={o.id} value={o.id} className="bg-[#121214] text-[#e4e4e7]">
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AnalyticCard
          title="Сгенерированная выручка (30д)"
          value={formatRub(eesScaled.generatedRevenueMonthRub)}
          trend="атрибуция к ИИ"
          isPositive
          icon={<TrendingUp className="w-5 h-5 text-[#10b981]" />}
        />
        <AnalyticCard
          title="Спасённые деньги"
          value={formatRub(eesScaled.savedMoneyRub)}
          trend="без лишних скидок"
          isPositive
          icon={<PiggyBank className="w-5 h-5 text-[#22d3ee]" />}
        />
        <AnalyticCard
          title="Возврат из зоны риска"
          value={`${eesScaled.churnRiskReturnedCount} чел.`}
          trend={`охват риска: ${eesScaled.churnRiskContactedCount}`}
          isPositive
          icon={<Shield className="w-5 h-5 text-[#f59e0b]" />}
        />
      </div>

      {advanced ? (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="crm-panel p-6">
          <h3 className="text-[15px] font-medium text-white mb-6 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#10b981]" /> Динамика: выручка после ИИ vs органика
          </h3>
          <div className="h-[280px] min-w-0 w-full">
            <ClientMount minHeight={280}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <AreaChart data={revenueFiltered} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorAI2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorMan2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#71717a" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#71717a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f1f22" vertical={false} />
                <XAxis dataKey="name" stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis
                  stroke="#71717a"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `₽${value / 1000000}M`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#121214',
                    border: '1px solid #1f1f22',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#d4d4d8',
                  }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="ai"
                  name="После касания ИИ"
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorAI2)"
                />
                <Area
                  type="monotone"
                  dataKey="manual"
                  name="Органика"
                  stroke="#71717a"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorMan2)"
                />
              </AreaChart>
            </ResponsiveContainer>
            </ClientMount>
          </div>
        </div>

        <div className="crm-panel p-6">
          <h3 className="text-[15px] font-medium text-white mb-2 flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#f59e0b]" /> Churn prevention: риск → возврат
          </h3>
          <p className="text-xs text-[#71717a] mb-4">
            Сколько клиентов из зоны риска совершили целевое действие после сценария удержания (демо по
            неделям).
          </p>
          <div className="h-[280px] min-w-0 w-full">
            <ClientMount minHeight={280}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={churnWeeks} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f1f22" vertical={false} />
                <XAxis dataKey="week" stroke="#71717a" fontSize={11} />
                <YAxis stroke="#71717a" fontSize={11} />
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
        <h3 className="text-[15px] font-medium text-white mb-6 flex items-center gap-2">
          <Target className="w-4 h-4 text-[#8b5cf6]" /> Воронка продаж через ИИ
        </h3>
        <div className="h-[300px] min-w-0 w-full">
          <ClientMount minHeight={300}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart layout="vertical" data={funnelData} margin={{ top: 0, right: 0, left: 30, bottom: 0 }}>
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
                {funnelData.map((_, index) => (
                  <Cell key={`c-${index}`} fill={`rgba(139, 92, 246, ${1 - index * 0.12})`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          </ClientMount>
        </div>
      </div>
      ) : null}
    </div>
  );
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
