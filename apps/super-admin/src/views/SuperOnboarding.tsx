'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CreditCard,
  Rocket,
  Mail,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ONBOARDING_QUEUE,
  type OnboardingRow,
  type OnboardingStage,
  readOnboardingStages,
  writeOnboardingStages,
} from '@/lib/superAdminData';

const STAGE_LABEL: Record<OnboardingStage, string> = {
  paid: 'Оплата получена',
  workspace_ready: 'Workspace создан',
  invite_sent: 'Инвайт отправлен',
  active: 'Активен',
};

const STAGE_ORDER: OnboardingStage[] = ['paid', 'workspace_ready', 'invite_sent', 'active'];

function nextStage(s: OnboardingStage): OnboardingStage | null {
  const i = STAGE_ORDER.indexOf(s);
  if (i < 0 || i >= STAGE_ORDER.length - 1) return null;
  return STAGE_ORDER[i + 1];
}

export function SuperOnboarding() {
  const [stages, setStages] = useState<Record<string, OnboardingStage>>({});

  useEffect(() => {
    setStages(readOnboardingStages());
  }, []);

  const rows = useMemo(() => {
    return ONBOARDING_QUEUE.map((r) => ({
      ...r,
      stage: stages[r.id] ?? r.stage,
    }));
  }, [stages]);

  const advance = useCallback((id: string, row: OnboardingRow) => {
    setStages((prev) => {
      const current = prev[id] ?? row.stage;
      const n = nextStage(current);
      if (!n) return prev;
      const base = { ...prev, [id]: n };
      writeOnboardingStages(base);
      return base;
    });
  }, []);

  return (
    <div className="sa-page flex-1 min-h-0 overflow-y-auto w-full max-w-6xl mx-auto px-4 sm:px-8 lg:px-10 py-8 space-y-8">
      <div className="sa-glow-line max-w-md mb-2 opacity-80" />
      <div>
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-amber-600/90 font-bold mb-2">
          <CreditCard className="w-4 h-4 text-amber-400" />
          После оплаты подписки
        </div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight">
          Онбординг новых клиентов
        </h1>
        <p className="text-zinc-400 mt-2 text-[15px] max-w-2xl leading-relaxed">
          Очередь оплат из биллинга: создайте workspace, отправьте инвайт владельцу, завершите активацию.
          В проде этапы синхронизируются с платёжным шлюзом и почтой.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {STAGE_ORDER.map((s, idx) => (
          <div
            key={s}
            className="sa-card sa-card-hover p-4 flex flex-col gap-1 border-amber-900/20"
          >
            <span className="text-[10px] font-bold text-amber-700/80 uppercase tracking-wider">
              Шаг {idx + 1}
            </span>
            <span className="text-sm font-medium text-zinc-200">{STAGE_LABEL[s]}</span>
          </div>
        ))}
      </div>

      <div className="sa-card overflow-hidden rounded-xl border border-zinc-700/50">
        <div className="px-5 py-4 border-b border-zinc-800/80 flex items-center gap-2 bg-zinc-900/40">
          <Rocket className="w-5 h-5 text-amber-500" />
          <h2 className="text-[15px] font-semibold text-white">Очередь активации</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[900px]">
            <thead className="text-[11px] uppercase tracking-wider text-zinc-500 border-b border-zinc-800/80">
              <tr>
                <th className="px-4 py-3 font-semibold">Компания</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Тариф</th>
                <th className="px-4 py-3 font-semibold text-right">Сумма</th>
                <th className="px-4 py-3 font-semibold">Оплачено</th>
                <th className="px-4 py-3 font-semibold">Этап</th>
                <th className="px-4 py-3 font-semibold text-right">Действие</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80">
              {rows.map((r) => {
                const n = nextStage(r.stage);
                return (
                  <tr key={r.id} className="hover:bg-zinc-900/40 transition-colors">
                    <td className="px-4 py-3 font-medium text-white">{r.companyName}</td>
                    <td className="px-4 py-3 text-zinc-400 font-mono text-[13px]">{r.email}</td>
                    <td className="px-4 py-3 text-zinc-300">{r.planPaid}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-emerald-400/90">
                      ₽ {r.amountRub.toLocaleString('ru-RU')}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 tabular-nums text-[13px]">
                      {new Date(r.paidAt).toLocaleString('ru-RU')}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex text-[11px] font-semibold px-2 py-0.5 rounded-md border',
                          r.stage === 'active' &&
                            'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
                          r.stage === 'paid' && 'bg-amber-500/15 text-amber-200 border-amber-500/35',
                          r.stage === 'workspace_ready' &&
                            'bg-sky-500/15 text-sky-300 border-sky-500/30',
                          r.stage === 'invite_sent' &&
                            'bg-violet-500/15 text-violet-300 border-violet-500/30'
                        )}
                      >
                        {STAGE_LABEL[r.stage]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {n ? (
                        <button
                          type="button"
                          onClick={() => advance(r.id, r)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-200 border border-amber-500/35 hover:bg-amber-500/30"
                        >
                          {n === 'workspace_ready' && (
                            <>
                              <Rocket className="w-3.5 h-3.5" /> Создать workspace
                            </>
                          )}
                          {n === 'invite_sent' && (
                            <>
                              <Mail className="w-3.5 h-3.5" /> Отправить инвайт
                            </>
                          )}
                          {n === 'active' && (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" /> Завершить активацию
                            </>
                          )}
                          <ChevronRight className="w-3.5 h-3.5 opacity-70" />
                        </button>
                      ) : (
                        <span className="text-xs text-emerald-600/90 font-medium">Готово</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-zinc-600 max-w-3xl">
        Демо: этапы в <span className="font-mono">localStorage</span> (
        <span className="font-mono text-[10px]">super_onboarding_stages</span>).
      </p>
    </div>
  );
}
