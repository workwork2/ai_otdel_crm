'use client';

import React from 'react';
import { Activity, Radio, Plug } from 'lucide-react';
import { INTEGRATION_ERRORS, QUEUE_STATS } from '@/lib/superAdminData';

export function SuperMonitoring() {
  return (
    <div className="sa-page flex-1 min-h-0 overflow-y-auto w-full max-w-6xl mx-auto px-4 sm:px-8 lg:px-10 py-8 space-y-8">
      <div className="sa-glow-line max-w-md opacity-80" />
      <div>
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-amber-600/90 font-bold mb-2">
          <Activity className="w-4 h-4 text-amber-400" />
          Технический мониторинг
        </div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight">
          Очереди и интеграции
        </h1>
        <p className="text-zinc-400 mt-2 text-[15px] max-w-2xl leading-relaxed">
          Сколько сообщений в полёте по каналам и последние ошибки интеграций (токены, лимиты, 401).
        </p>
      </div>

      <section>
        <div className="flex items-center gap-2 mb-4">
          <Radio className="w-5 h-5 text-emerald-400" />
          <h2 className="text-lg font-medium text-white">Очереди рассылки</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {QUEUE_STATS.map((q) => (
            <div
              key={q.channel}
              className="sa-card p-5 border border-emerald-500/15 bg-emerald-950/10"
            >
              <div className="text-[11px] uppercase tracking-wider text-emerald-600/90 font-semibold mb-3">
                {q.channel}
              </div>
              <dl className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <dt className="text-[#71717a] text-[11px]">В очереди</dt>
                  <dd className="text-white font-semibold tabular-nums">
                    {q.pending.toLocaleString('ru-RU')}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#71717a] text-[11px]">Отправка</dt>
                  <dd className="text-emerald-300 font-semibold tabular-nums">
                    {q.sending.toLocaleString('ru-RU')}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#71717a] text-[11px]">Ошибки 24ч</dt>
                  <dd className="text-amber-200 font-semibold tabular-nums">{q.failed24h}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      </section>

      <section className="sa-card overflow-hidden rounded-xl border border-zinc-700/50">
        <div className="px-5 py-4 border-b border-[#1f1f22] flex items-center gap-2">
          <Plug className="w-5 h-5 text-amber-500 shrink-0" />
          <h2 className="text-[15px] font-medium text-white">Логи ошибок интеграций</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[640px]">
            <thead className="bg-[#121214] text-[11px] uppercase tracking-wider text-[#71717a] border-b border-[#1f1f22]">
              <tr>
                <th className="px-4 py-3 font-semibold">Время</th>
                <th className="px-4 py-3 font-semibold">Tenant</th>
                <th className="px-4 py-3 font-semibold">Канал</th>
                <th className="px-4 py-3 font-semibold">Деталь</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1f1f22]">
              {INTEGRATION_ERRORS.map((row) => (
                <tr key={row.id} className="hover:bg-[#121214]/50">
                  <td className="px-4 py-3 text-[#a1a1aa] tabular-nums whitespace-nowrap">
                    {new Date(row.at).toLocaleString('ru-RU')}
                  </td>
                  <td className="px-4 py-3 text-white">{row.tenantName}</td>
                  <td className="px-4 py-3 text-sky-300">{row.channel}</td>
                  <td className="px-4 py-3 text-[#d4d4d8]">{row.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
