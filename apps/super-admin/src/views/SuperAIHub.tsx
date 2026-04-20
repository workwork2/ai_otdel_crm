'use client';

import React, { useEffect, useState } from 'react';
import { Brain, AlertTriangle, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  AI_ERROR_LOGS,
  DEFAULT_MASTER_PROMPT,
  MASTER_PROMPT_KEY,
  type AIErrorLogRow,
} from '@/lib/superAdminData';

const KIND_LABEL: Record<AIErrorLogRow['kind'], string> = {
  hallucination: 'Галлюцинация',
  refusal: 'Отказ',
  parse: 'Парсинг',
  timeout: 'Таймаут',
};

export function SuperAIHub() {
  const [prompt, setPrompt] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const s = localStorage.getItem(MASTER_PROMPT_KEY);
      setPrompt(s || DEFAULT_MASTER_PROMPT);
    } catch {
      setPrompt(DEFAULT_MASTER_PROMPT);
    }
  }, []);

  const savePrompt = () => {
    try {
      localStorage.setItem(MASTER_PROMPT_KEY, prompt);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } catch {
      /* quota */
    }
  };

  return (
    <div className="sa-page flex-1 min-h-0 overflow-y-auto w-full max-w-6xl mx-auto px-4 sm:px-8 lg:px-10 py-8 space-y-8">
      <div className="sa-glow-line max-w-md opacity-80" />
      <div>
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-amber-600/90 font-bold mb-2">
          <Brain className="w-4 h-4 text-amber-400" />
          AI Prompt Engineering
        </div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight">
          Глобальный мастер-промпт и логи
        </h1>
        <p className="text-zinc-400 mt-2 text-[15px] max-w-2xl leading-relaxed">
          Текст ниже подмешивается ко всем запросам ко всем клиентам (в проде — через слой политики). Логи —
          для разбора сбоев и галлюцинаций.
        </p>
      </div>

      <section className="sa-card p-6 space-y-4 border-amber-900/25">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-lg font-medium text-white">Глобальный мастер-промпт</h2>
          <button
            type="button"
            onClick={savePrompt}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-600/90 hover:bg-amber-500 text-white text-sm font-semibold px-4 py-2 transition-colors"
          >
            <Save className="w-4 h-4" />
            {saved ? 'Сохранено' : 'Сохранить'}
          </button>
        </div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={12}
          className="w-full resize-y rounded-xl border border-[#27272a] bg-[#0a0a0c] text-[13px] text-[#e4e4e7] leading-relaxed px-4 py-3 outline-none focus:border-amber-600/50 font-mono"
        />
        <p className="text-xs text-[#71717a]">
          Хранится в браузере (<span className="font-mono">{MASTER_PROMPT_KEY}</span>), для демо без бэкенда.
        </p>
      </section>

      <section className="sa-card overflow-hidden rounded-xl border border-zinc-700/50">
        <div className="px-5 py-4 border-b border-[#1f1f22] flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
          <h2 className="text-[15px] font-medium text-white">Логи ошибок ИИ</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[720px]">
            <thead className="bg-[#121214] text-[11px] uppercase tracking-wider text-[#71717a] border-b border-[#1f1f22]">
              <tr>
                <th className="px-4 py-3 font-semibold">Время</th>
                <th className="px-4 py-3 font-semibold">Tenant</th>
                <th className="px-4 py-3 font-semibold">Модель</th>
                <th className="px-4 py-3 font-semibold">Тип</th>
                <th className="px-4 py-3 font-semibold">Фрагмент</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1f1f22]">
              {AI_ERROR_LOGS.map((row) => (
                <tr key={row.id} className="hover:bg-[#121214]/50">
                  <td className="px-4 py-3 text-[#a1a1aa] tabular-nums whitespace-nowrap">
                    {new Date(row.at).toLocaleString('ru-RU')}
                  </td>
                  <td className="px-4 py-3 text-white">{row.tenantName}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[#a1a1aa]">{row.model}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'text-[11px] font-medium px-2 py-0.5 rounded border',
                        row.kind === 'hallucination' && 'bg-red-500/10 text-red-300 border-red-500/25',
                        row.kind === 'parse' && 'bg-violet-500/10 text-violet-300 border-violet-500/25',
                        row.kind === 'timeout' && 'bg-amber-500/10 text-amber-200 border-amber-500/25',
                        row.kind === 'refusal' && 'bg-zinc-700/50 text-zinc-300 border-zinc-600/40'
                      )}
                    >
                      {KIND_LABEL[row.kind]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#d4d4d8] max-w-md">{row.snippet}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
