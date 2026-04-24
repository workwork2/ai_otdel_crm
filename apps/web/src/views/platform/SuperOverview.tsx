'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { TrendingUp, MessageSquare, DollarSign, Sparkles, PieChart, ArrowUpRight } from 'lucide-react';
import { getApiBaseUrl, superFetchHeaders } from '@/lib/backend-api';
import { PLATFORM_BASE } from '@/lib/platform-routes';
import { cn } from '@/lib/utils';

function fmtRub(n: number) {
  if (n >= 1_000_000) return `₽ ${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1000) return `₽ ${(n / 1000).toFixed(1)}k`;
  return `₽ ${n.toLocaleString('ru-RU')}`;
}

function fmtUsd(n: number) {
  return `$ ${n.toLocaleString('en-US')}`;
}

type Metrics = {
  totalMrrRub: number;
  totalMessagesGenerated: number;
  apiClaudeSpendUsd: number;
  totalGeneratedRevenueRub: number;
  activeTenants: number;
  frozenTenants: number;
};

const ZERO_METRICS: Metrics = {
  totalMrrRub: 0,
  totalMessagesGenerated: 0,
  apiClaudeSpendUsd: 0,
  totalGeneratedRevenueRub: 0,
  activeTenants: 0,
  frozenTenants: 0,
};

type TicketRow = { status?: string };

export function SuperOverview() {
  const apiBase = getApiBaseUrl();
  const [m, setM] = useState<Metrics>(ZERO_METRICS);
  const [supportOpenCount, setSupportOpenCount] = useState(0);

  const load = useCallback(async () => {
    if (!apiBase) {
      setM(ZERO_METRICS);
      setSupportOpenCount(0);
      return;
    }
    try {
      const [rMetrics, rTickets] = await Promise.all([
        fetch(`${apiBase}/v1/super/metrics`, { headers: superFetchHeaders() }),
        fetch(`${apiBase}/v1/super/support-tickets`, { headers: superFetchHeaders() }),
      ]);
      if (rMetrics.ok) {
        const data = (await rMetrics.json()) as Partial<Metrics>;
        if (data && typeof data === 'object') setM({ ...ZERO_METRICS, ...data });
        else setM(ZERO_METRICS);
      } else {
        setM(ZERO_METRICS);
      }
      if (rTickets.ok) {
        const rows = (await rTickets.json()) as TicketRow[];
        if (Array.isArray(rows)) {
          setSupportOpenCount(rows.filter((t) => t.status !== 'resolved').length);
        } else setSupportOpenCount(0);
      } else setSupportOpenCount(0);
    } catch {
      setM(ZERO_METRICS);
      setSupportOpenCount(0);
    }
  }, [apiBase]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="sa-page flex-1 min-h-0 overflow-y-auto w-full max-w-6xl mx-auto px-4 sm:px-8 lg:px-10 py-8 space-y-8">
      <div className="sa-glow-line max-w-md opacity-90" />
      <div>
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-amber-600/90 font-bold mb-2">
          <PieChart className="w-4 h-4 text-amber-400" />
          Глобальная аналитика
        </div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight">MRR Dashboard</h1>
        <p className="text-zinc-400 mt-2 text-[15px] max-w-2xl leading-relaxed">
          Сводка по всей платформе: подписки, сообщения ИИ, расходы на Claude и суммарная атрибутируемая
          выручка клиентов — для операционного контроля и инвесторов.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <MetricCard
          title="Total MRR"
          subtitle="Ежемесячная регулярная выручка от подписок"
          value={fmtRub(m.totalMrrRub)}
          icon={<TrendingUp className="w-5 h-5 text-emerald-400" />}
          accent="border-emerald-500/20"
        />
        <MetricCard
          title="Сообщений сгенерировано"
          subtitle="За всё время по всем tenants"
          value={m.totalMessagesGenerated.toLocaleString('ru-RU')}
          icon={<MessageSquare className="w-5 h-5 text-sky-400" />}
          accent="border-sky-500/20"
        />
        <MetricCard
          title="Расходы API Claude"
          subtitle="Оценка за текущий период (маржа)"
          value={fmtUsd(m.apiClaudeSpendUsd)}
          icon={<DollarSign className="w-5 h-5 text-amber-400" />}
          accent="border-amber-500/25"
        />
        <MetricCard
          title="Сгенерированная выручка (все клиенты)"
          subtitle="Атрибуция к ИИ, все tenants — для инвесторов"
          value={fmtRub(m.totalGeneratedRevenueRub)}
          icon={<Sparkles className="w-5 h-5 text-violet-400" />}
          accent="border-violet-500/20"
        />
      </div>

      <div className="sa-card p-5 border-amber-900/30 bg-amber-950/15">
        <div className="text-[11px] font-bold uppercase tracking-wider text-amber-600/90 mb-2">
          Быстрый срез
        </div>
        <p className="text-sm text-zinc-300 leading-relaxed">
          Активных организаций: <strong className="text-white">{m.activeTenants}</strong>, заморожено:{' '}
          <strong className="text-white">{m.frozenTenants}</strong>.
          {supportOpenCount > 0 ? (
            <>
              {' '}
              Открытых обращений в поддержку:{' '}
              <strong className="text-amber-300">{supportOpenCount}</strong>.
            </>
          ) : null}
        </p>
        <div className="flex flex-wrap gap-3 mt-4">
          <Link
            href={`${PLATFORM_BASE}/tenants`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300"
          >
            Все организации <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
          <Link
            href={`${PLATFORM_BASE}/onboarding`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300"
          >
            Очередь после оплаты <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
          <Link
            href={`${PLATFORM_BASE}/support`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300"
          >
            Поддержка <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  subtitle,
  value,
  icon,
  accent,
}: {
  title: string;
  subtitle: string;
  value: string;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <div className={cn('sa-card sa-card-hover p-5 border', accent)}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="text-[11px] text-zinc-500 uppercase tracking-wider">{title}</div>
        <div className="text-zinc-600">{icon}</div>
      </div>
      <div className="text-2xl font-bold text-white tracking-tight">{value}</div>
      <p className="text-xs text-zinc-500 mt-2 leading-snug">{subtitle}</p>
    </div>
  );
}
