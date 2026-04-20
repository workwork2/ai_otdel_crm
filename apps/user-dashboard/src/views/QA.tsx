'use client';

import React, { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Hand,
  CheckCircle,
  Search,
  Filter,
  ChevronUp,
  ChevronDown,
  Shield,
  Send,
  UserCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { mockAIDialogues } from '@/data';
import type { QAChannel, QADialogue, QADialogueMessage, QADialogueStatus } from '@/types';

const QA_STORAGE = 'aura-qa-dialogues-v1';

function loadDialogues(): QADialogue[] {
  try {
    const raw = localStorage.getItem(QA_STORAGE);
    if (raw) {
      const p = JSON.parse(raw) as QADialogue[];
      if (Array.isArray(p) && p.length > 0) return p;
    }
  } catch {
    /* ignore */
  }
  return mockAIDialogues;
}

const CHANNEL_LABEL: Record<QAChannel, string> = {
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  sms: 'SMS',
  email: 'Email',
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
  const [dialogues, setDialogues] = useState<QADialogue[]>(loadDialogues);
  const [selectedId, setSelectedId] = useState<string>(() => loadDialogues()[0]?.id ?? '');
  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState<QAChannel | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<QADialogueStatus | 'all'>('all');
  const [draft, setDraft] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem(QA_STORAGE, JSON.stringify(dialogues));
    } catch {
      /* quota */
    }
  }, [dialogues]);

  const sorted = useMemo(
    () => [...dialogues].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)),
    [dialogues]
  );

  const filtered = useMemo(() => {
    return sorted.filter((d) => {
      if (channelFilter !== 'all' && d.channel !== channelFilter) return false;
      if (statusFilter !== 'all' && d.status !== statusFilter) return false;
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

  const needAttentionCount = useMemo(
    () => dialogues.filter((d) => d.status === 'warning' || d.status === 'intercepted').length,
    [dialogues]
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

  const intercept = (id: string) => {
    setDialogues((prev) =>
      prev.map((d) =>
        d.id === id
          ? {
              ...d,
              status: 'intercepted' as const,
              managerNote:
                'Диалог перехвачен. ИИ приостановлен — напишите ответ ниже, он уйдёт клиенту после подключения канала.',
              updatedAt: new Date().toISOString().slice(0, 19),
            }
          : d
      )
    );
  };

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

  const showComposer = selected?.status === 'intercepted';

  return (
    <div className="flex flex-1 min-h-0 h-full font-sans">
      <div className="w-[340px] flex flex-col border-r border-[#1f1f22] bg-[#0a0a0c] shrink-0">
        <div className="p-4 border-b border-[#1f1f22] space-y-3">
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

          <div className="flex gap-2">
            <div className="relative flex-1">
              <select
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value as QAChannel | 'all')}
                className="w-full bg-[#121214] border border-[#1f1f22] text-xs text-zinc-300 rounded-md pl-2 pr-7 py-1.5 focus:outline-none focus:border-[#3b82f6]/50 appearance-none cursor-pointer"
              >
                <option value="all">Все каналы</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="telegram">Telegram</option>
                <option value="sms">SMS</option>
                <option value="email">Email</option>
              </select>
              <Filter className="w-3 h-3 absolute right-2 top-2 text-zinc-500 pointer-events-none" />
            </div>
            <div className="relative flex-1">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as QADialogueStatus | 'all')}
                className="w-full bg-[#121214] border border-[#1f1f22] text-xs text-zinc-300 rounded-md pl-2 pr-7 py-1.5 focus:outline-none focus:border-[#3b82f6]/50 appearance-none cursor-pointer"
              >
                <option value="all">Все статусы</option>
                <option value="warning">Требует внимания</option>
                <option value="intercepted">Перехвачен</option>
                <option value="active">В диалоге</option>
                <option value="success">Успешно</option>
              </select>
              <Filter className="w-3 h-3 absolute right-2 top-2 text-zinc-500 pointer-events-none" />
            </div>
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
                  <span className="font-medium text-[14px] text-white truncate">{d.client}</span>
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

      <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-[#0a0a0c]">
        {selected ? (
          <>
            <div className="shrink-0 border-b border-[#1f1f22] px-8 py-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex items-start gap-4">
                <div
                  className="w-12 h-12 rounded-full bg-[#121214] border border-[#1f1f22] flex items-center justify-center text-sm font-bold text-white"
                  style={{ boxShadow: `0 0 0 1px ${statusColor(selected.status)}40` }}
                >
                  {selected.clientInitials}
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-white">{selected.client}</h1>
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
                {(selected.status === 'warning' || selected.status === 'active') && (
                  <button
                    type="button"
                    onClick={() => intercept(selected.id)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#3b82f6]/15 text-[#3b82f6] border border-[#3b82f6]/30 hover:bg-[#3b82f6]/25 rounded-lg text-sm font-semibold"
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

            <div className="flex-1 overflow-y-auto custom-scrollbar px-8 py-6 min-h-0">
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
              <div className="shrink-0 border-t border-[#1f1f22] bg-[#0a0a0c] px-8 py-4">
                <div className="max-w-3xl flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-xs text-[#71717a]">
                    <UserCircle2 className="w-4 h-4 text-[#3b82f6]" />
                    <span>
                      Ответ менеджера в {CHANNEL_LABEL[selected.channel]} (после перехвата; в проде уйдёт в API
                      канала)
                    </span>
                  </div>
                  <div className="flex gap-3">
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
                      className="flex-1 bg-[#121214] border border-[#1f1f22] rounded-xl px-4 py-3 text-sm text-[#e4e4e7] placeholder:text-[#52525b] focus:outline-none focus:border-[#3b82f6]/50 resize-y min-h-[88px]"
                    />
                    <button
                      type="button"
                      onClick={sendManagerMessage}
                      disabled={!draft.trim()}
                      className="self-end shrink-0 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#3b82f6] text-white text-sm font-semibold hover:bg-[#2563eb] disabled:opacity-40 disabled:pointer-events-none"
                    >
                      <Send className="w-4 h-4" />
                      Отправить
                    </button>
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
