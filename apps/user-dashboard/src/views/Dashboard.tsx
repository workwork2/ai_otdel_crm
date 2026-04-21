'use client';

import React, { Fragment, useMemo } from 'react';
import Link from 'next/link';
import { Activity, Zap, TrendingUp, PiggyBank, Shield, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAudienceData } from '@/context/AudienceDataContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { ClientMount } from '@/components/ClientMount';
import { computeEESMetrics, formatRub, churnPreventionTrend } from '@/lib/eesMetrics';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export function Dashboard() {
  const { clients } = useAudienceData();
  const { subscription } = useSubscription();
  const ees = useMemo(() => computeEESMetrics(clients), [clients]);
  const churnData = useMemo(() => churnPreventionTrend(), []);
  const shareReturned =
    ees.churnRiskContactedCount > 0
      ? Math.round((ees.churnRiskReturnedCount / ees.churnRiskContactedCount) * 100)
      : 0;

  return (
    <div className="flex-1 overflow-y-auto w-full mx-auto px-10 py-8 space-y-8 fade-in">
      <div>
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-[#71717a] font-semibold mb-2">
          <Sparkles className="w-4 h-4 text-[#8b5cf6]" />
          EES — единая экономика сценариев
        </div>
        <h1 className="text-3xl font-semibold text-white tracking-tight">Обзор эффективности</h1>
        <p className="text-[#a1a1aa] mt-2 text-[15px] max-w-3xl">
          Автоматизация касаний, удержание в зоне риска и атрибуция выручки к сообщениям ИИ. База:{' '}
          <span className="text-white font-medium">{ees.clientsInBase}</span> клиентов — подходит для
          retail, услуг и B2B.
        </p>
        {subscription?.planKey === 'trial' ? (
          <div className="mt-4 rounded-xl border border-violet-500/25 bg-violet-500/10 px-4 py-3 text-sm text-violet-100/95 max-w-3xl">
            <span className="font-medium text-white">Пробный тариф:</span> часть функций (QA, Excel, расширенная
            аналитика) открывается после апгрейда. Для показа клиенту переключение — в{' '}
            <Link href="/billing" className="text-violet-200 underline underline-offset-2">
              Мой тариф
            </Link>
            .
          </div>
        ) : null}
      </div>

      {/* Главные KPI EES */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <HeroKpi
          title="Сгенерированная выручка (30 дней)"
          subtitle="Покупки после касания ИИ, атрибуция по цепочке"
          value={formatRub(ees.generatedRevenueMonthRub)}
          icon={<TrendingUp className="w-6 h-6 text-[#10b981]" />}
          accent="border-[#10b981]/30 bg-gradient-to-br from-[#10b981]/10 to-transparent"
        />
        <HeroKpi
          title="Спасённые деньги"
          subtitle="Не выданные лишние скидки тем, кто конвертировал бы и без них"
          value={formatRub(ees.savedMoneyRub)}
          icon={<PiggyBank className="w-6 h-6 text-[#22d3ee]" />}
          accent="border-[#22d3ee]/30 bg-gradient-to-br from-cyan-500/10 to-transparent"
        />
        <HeroKpi
          title="Возврат из зоны риска"
          subtitle={`Клиенты с высоким риском, совершившие покупку после сценария удержания · ~${shareReturned}% от охвата`}
          value={`${ees.churnRiskReturnedCount}`}
          suffix=" чел."
          icon={<Shield className="w-6 h-6 text-[#f59e0b]" />}
          accent="border-[#f59e0b]/30 bg-gradient-to-br from-[#f59e0b]/10 to-transparent"
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <Tag label="Зона риска / в работе ИИ" count={String(ees.churnRiskContactedCount)} status="neutral" />
        <Tag label="Вернувшиеся после удержания" count={String(ees.churnRiskReturnedCount)} status="up" />
        <Tag label="Клиентов в базе" count={String(ees.clientsInBase)} status="neutral" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="КЛИЕНТОВ В БАЗЕ" value={String(ees.clientsInBase)} sub="импорт Excel + CRM" />
        <StatCard
          title="ПРИОРИТЕТ ИИ (ср.)"
          value={
            clients.length
              ? String(
                  Math.round(
                    clients.reduce((s, c) => s + (c.scoring?.priorityScore ?? 0), 0) / clients.length
                  )
                )
              : '—'
          }
          sub="очередь касаний"
        />
        <StatCard title="КОНВЕРСИЯ ИЗ КАСАНИЯ" value="34%" sub="демо-оценка" subColor="text-[#10b981]" />
        <StatCard title="RETENTION 90D" value="61%" sub="+4% к прошлому кварталу" subColor="text-[#10b981]" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[15px] font-medium text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#3b82f6]" />
              Очередь ИИ: кого касаемся сейчас
            </h3>
            <button
              type="button"
              className="px-3 py-1 text-xs font-medium border border-[#1f1f22] text-[#d4d4d8] rounded hover:bg-[#1f1f22] transition-colors"
            >
              Обновить
            </button>
          </div>

          <div className="crm-panel overflow-hidden">
            <table className="w-full text-left text-sm text-[#d4d4d8]">
              <thead className="border-b border-[#1f1f22] text-[11px] text-[#a1a1aa] uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-4 font-normal">КЛИЕНТ</th>
                  <th className="px-5 py-4 font-normal">СЕГМЕНТ</th>
                  <th className="px-5 py-4 font-normal">РИСК / ПРИОРИТЕТ</th>
                  <th className="px-5 py-4 font-normal">СЦЕНАРИЙ</th>
                  <th className="px-5 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1f1f22]">
                {clients.slice(0, 6).map((c) => (
                  <Fragment key={c.id}>
                    <TableRow
                      contact={c.name}
                      desc={`${c.loyalty.tier} · ${c.type.toUpperCase()}`}
                      segment={c.scoring?.churnSegment ?? '—'}
                      metric={`${c.scoring?.riskIndex ?? '—'} риск · ${c.scoring?.priorityScore ?? '—'} приоритет`}
                      touch={c.loyalty.nextAction.slice(0, 42) + '…'}
                      status={(c.scoring?.riskIndex ?? 0) >= 60 ? 'yellow' : 'green'}
                    />
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="crm-panel p-5">
            <h3 className="text-[14px] font-medium text-white mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#f59e0b]" />
              Удержание: зона риска → возврат
            </h3>
            <div className="h-[200px] min-w-0 w-full">
              <ClientMount minHeight={200}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <AreaChart data={churnData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gRet" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f1f22" vertical={false} />
                    <XAxis dataKey="week" stroke="#71717a" fontSize={10} tickLine={false} />
                    <YAxis stroke="#71717a" fontSize={10} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#121214',
                        border: '1px solid #1f1f22',
                        borderRadius: '8px',
                        fontSize: '12px',
                        color: '#d4d4d8',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="returned"
                      name="Вернулись"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#gRet)"
                    />
                    <Area
                      type="monotone"
                      dataKey="inRisk"
                      name="В зоне риска"
                      stroke="#71717a"
                      strokeWidth={1}
                      fillOpacity={0}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ClientMount>
            </div>
            <p className="text-[11px] text-[#71717a] mt-2">
              Оранжевая зона — клиенты, вернувшиеся к покупке после сценария удержания (демо-тренд).
            </p>
          </div>

          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-5 h-5 text-[#f59e0b]" />
            <h3 className="text-[15px] font-medium text-white">Активные сценарии</h3>
          </div>

          <div className="space-y-3">
            <AutomationCard
              title="Возврат ушедших"
              trigger=">60 дней без покупки · зона риска"
              action="Персональное касание · атрибуция выручки"
            />
            <AutomationCard
              title="Анти-скидка"
              trigger="Намерение купить без доп. бонуса"
              action="Экономия на марже · «спасённые деньги»"
            />
            <AutomationCard
              title="Продление B2B"
              trigger="Окончание контракта / лицензии"
              action="Telegram / email · up-sell"
            />
          </div>

          <div className="pt-2">
            <h3 className="text-[15px] font-medium text-white mb-4">Лента</h3>
            <div className="space-y-4">
              <FeedItem time="13:00" title="Импорт базы" desc="Excel объединён с текущей CRM-витриной" />
              <FeedItem time="12:15" title="Скоринг обновлён" desc="Пересчёт сегментов оттока по чекам" />
              <FeedItem time="10:42" title="EES" desc="Атрибуция выручки за апрель пересчитана" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroKpi({
  title,
  subtitle,
  value,
  suffix,
  icon,
  accent,
}: {
  title: string;
  subtitle: string;
  value: string;
  suffix?: string;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <div className={cn('crm-card p-6 border relative overflow-hidden', accent)}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="w-11 h-11 rounded-xl bg-[#121214]/80 border border-[#1f1f22] flex items-center justify-center">
          {icon}
        </div>
      </div>
      <div className="text-[11px] text-[#a1a1aa] uppercase tracking-wider mb-1">{title}</div>
      <div className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
        {value}
        {suffix && <span className="text-lg text-[#a1a1aa] font-medium ml-1">{suffix}</span>}
      </div>
      <p className="text-xs text-[#71717a] mt-2 leading-relaxed">{subtitle}</p>
    </div>
  );
}

function Tag({ label, count, status }: { label: string; count: string; status: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#1f1f22] bg-transparent text-sm text-[#d4d4d8]">
      <span>{label}</span>
      <span className="font-semibold text-white">{count}</span>
      {status === 'neutral' && <div className="w-2 h-2 bg-zinc-500 rounded-sm" />}
      {status === 'up' && (
        <div className="w-0 h-0 border-l-4 border-r-4 border-b-4 border-l-transparent border-r-transparent border-b-[#10b981]" />
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  sub,
  subColor = 'text-[#a1a1aa]',
}: {
  title: string;
  value: string;
  sub: string;
  subColor?: string;
}) {
  return (
    <div className="crm-card p-5">
      <div className="text-[11px] text-[#a1a1aa] uppercase tracking-wider mb-2">{title}</div>
      <div className="text-3xl font-semibold text-white mb-1">{value}</div>
      <div className={`text-xs ${subColor}`}>{sub}</div>
    </div>
  );
}

function TableRow({
  contact,
  desc,
  segment,
  metric,
  touch,
  status,
}: {
  contact: string;
  desc: string;
  segment: string;
  metric: string;
  touch: string;
  status: string;
}) {
  return (
    <tr className="hover:bg-[#18181b]/50 transition-colors">
      <td className="px-5 py-4">
        <div className="font-medium text-white">{contact}</div>
        <div className="text-xs text-[#a1a1aa] mt-0.5">{desc}</div>
      </td>
      <td className="px-5 py-4 text-[#d4d4d8] capitalize">{segment}</td>
      <td className="px-5 py-4 text-[#d4d4d8] text-xs">{metric}</td>
      <td className="px-5 py-4 text-[#d4d4d8] text-xs max-w-[180px]">{touch}</td>
      <td className="px-5 py-4 text-right">
        {status === 'green' && (
          <div className="w-2 h-2 rounded-full bg-[#10b981] ml-auto shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
        )}
        {status === 'yellow' && (
          <div className="w-2 h-2 rounded-full bg-[#f59e0b] ml-auto shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
        )}
      </td>
    </tr>
  );
}

function AutomationCard({ title, trigger, action }: { title: string; trigger: string; action: string }) {
  return (
    <div className="crm-card p-4 relative overflow-hidden group">
      <div className="flex justify-between items-start mb-2">
        <div className="text-sm font-medium text-white">{title}</div>
        <div className="text-[10px] uppercase font-bold text-[#10b981] border border-[#10b981]/30 bg-[#10b981]/10 px-1.5 py-0.5 rounded">
          Активно
        </div>
      </div>
      <div className="text-xs text-[#a1a1aa] mb-1">Триггер: {trigger}</div>
      <div className="text-xs text-[#d4d4d8]">{action}</div>
    </div>
  );
}

function FeedItem({ time, title, desc }: { time: string; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 relative before:absolute before:left-1 before:top-4 before:bottom-[-20px] before:w-[1px] before:bg-[#1f1f22] last:before:hidden">
      <div className="w-2 h-2 mt-1.5 rounded-full bg-[#0ea5e9] relative z-10 shrink-0" />
      <div>
        <div className="text-xs text-[#71717a] font-mono">{time}</div>
        <div className="text-sm text-white mt-0.5">{title}</div>
        <div className="text-xs text-[#a1a1aa] mt-0.5">{desc}</div>
      </div>
    </div>
  );
}
