'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Headphones, Send, CheckCircle, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  SUPPORT_TICKETS_SEED,
  SUPPORT_TICKETS_STORAGE_KEY,
  type SupportTicket,
} from '@/lib/superAdminData';

function loadTickets(): SupportTicket[] {
  if (typeof window === 'undefined') return SUPPORT_TICKETS_SEED;
  try {
    const raw = localStorage.getItem(SUPPORT_TICKETS_STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as SupportTicket[];
      if (Array.isArray(p) && p.length > 0) return p;
    }
  } catch {
    /* ignore */
  }
  return SUPPORT_TICKETS_SEED;
}

function saveTickets(t: SupportTicket[]) {
  try {
    localStorage.setItem(SUPPORT_TICKETS_STORAGE_KEY, JSON.stringify(t));
  } catch {
    /* quota */
  }
}

const PRIORITY: Record<SupportTicket['priority'], string> = {
  high: 'Срочно',
  normal: 'Обычный',
  low: 'Низкий',
};

export function SuperSupportInbox() {
  const [tickets, setTickets] = useState<SupportTicket[]>(SUPPORT_TICKETS_SEED);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    const t = loadTickets();
    setTickets(t);
    setSelectedId((id) => id ?? t[0]?.id ?? null);
  }, []);

  const selected = useMemo(
    () => tickets.find((x) => x.id === selectedId) ?? null,
    [tickets, selectedId]
  );

  const sendReply = useCallback(() => {
    const text = draft.trim();
    if (!text || !selectedId) return;
    setTickets((prev) => {
      const next = prev.map((t) => {
        if (t.id !== selectedId) return t;
        const msg = {
          id: crypto.randomUUID(),
          from: 'admin' as const,
          text,
          at: new Date().toISOString(),
        };
        return {
          ...t,
          status: 'pending' as const,
          updatedAt: msg.at,
          messages: [...t.messages, msg],
        };
      });
      saveTickets(next);
      return next;
    });
    setDraft('');
  }, [draft, selectedId]);

  const markResolved = useCallback(() => {
    if (!selectedId) return;
    setTickets((prev) => {
      const next = prev.map((t) =>
        t.id === selectedId
          ? { ...t, status: 'resolved' as const, updatedAt: new Date().toISOString() }
          : t
      );
      saveTickets(next);
      return next;
    });
  }, [selectedId]);

  return (
    <div className="sa-page flex-1 min-h-0 flex flex-col w-full max-w-6xl mx-auto px-4 sm:px-8 lg:px-10 py-8 min-h-0">
      <div className="sa-glow-line max-w-md mb-2 opacity-80" />
      <div className="shrink-0 mb-6">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-amber-600/90 font-bold mb-2">
          <Headphones className="w-4 h-4 text-amber-400" />
          Техподдержка
        </div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight">
          Чаты и обращения
        </h1>
        <p className="text-zinc-400 mt-2 text-[15px] max-w-2xl leading-relaxed">
          Отвечайте клиентам из панели: ответы сохраняются локально (демо). В проде — общая очередь с
          панелью клиента и email.
        </p>
      </div>

      <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-4 border border-zinc-800/80 rounded-xl overflow-hidden sa-card">
        <aside className="w-full md:w-[320px] shrink-0 border-b md:border-b-0 md:border-r border-zinc-800/80 bg-zinc-950/50 flex flex-col max-h-[40vh] md:max-h-none">
          <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500 border-b border-zinc-800/80">
            Очередь ({tickets.filter((t) => t.status !== 'resolved').length} открыто)
          </div>
          <ul className="overflow-y-auto flex-1 custom-scrollbar">
            {tickets.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(t.id)}
                  className={cn(
                    'w-full text-left px-4 py-3 border-b border-zinc-800/60 transition-colors',
                    selectedId === t.id
                      ? 'bg-amber-950/35 border-l-2 border-l-amber-500'
                      : 'hover:bg-zinc-900/60 border-l-2 border-l-transparent'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium text-zinc-100 line-clamp-1">{t.subject}</span>
                    {t.status === 'resolved' ? (
                      <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 text-amber-500/60 shrink-0" />
                    )}
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-1">{t.tenantName}</div>
                  <div className="text-[10px] text-amber-700/80 mt-1">{PRIORITY[t.priority]}</div>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="flex-1 min-h-0 flex flex-col bg-zinc-950/30">
          {selected ? (
            <>
              <div className="px-4 py-3 border-b border-zinc-800/80 shrink-0">
                <h2 className="text-lg font-semibold text-white">{selected.subject}</h2>
                <p className="text-xs text-zinc-500 mt-1">
                  {selected.tenantName} · обновлено{' '}
                  {new Date(selected.updatedAt).toLocaleString('ru-RU')}
                </p>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {selected.messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      'max-w-[90%] rounded-xl px-3 py-2 text-[13px] leading-relaxed',
                      m.from === 'admin'
                        ? 'ml-auto bg-amber-950/50 text-amber-50 border border-amber-800/40'
                        : 'mr-auto bg-zinc-800/80 text-zinc-200 border border-zinc-700/60'
                    )}
                  >
                    <p className="whitespace-pre-wrap">{m.text}</p>
                    <div className="text-[10px] text-zinc-500 mt-1.5">
                      {m.from === 'admin' ? 'Вы' : 'Клиент'} ·{' '}
                      {new Date(m.at).toLocaleString('ru-RU')}
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-3 border-t border-zinc-800/80 shrink-0 space-y-2">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Ответ клиенту…"
                  rows={3}
                  className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-950/80 text-sm text-zinc-100 placeholder:text-zinc-600 px-3 py-2 outline-none focus:border-amber-600/50"
                />
                <div className="flex flex-wrap gap-2 justify-end">
                  <button
                    type="button"
                    onClick={markResolved}
                    disabled={selected.status === 'resolved'}
                    className="text-xs font-semibold px-3 py-2 rounded-lg border border-zinc-600 text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
                  >
                    Закрыть тикет
                  </button>
                  <button
                    type="button"
                    onClick={sendReply}
                    disabled={!draft.trim()}
                    className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-40"
                  >
                    <Send className="w-4 h-4" />
                    Отправить ответ
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
              Выберите обращение слева
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
