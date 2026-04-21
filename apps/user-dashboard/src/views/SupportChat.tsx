'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Headphones, ImagePlus, Send, Trash2 } from 'lucide-react';
import { apiFetchJson } from '@/lib/api-client';
import { getApiBaseUrl, getTenantIdClient, jsonTenantHeaders, tenantFetchHeaders } from '@/lib/backend-api';
import { cn } from '@/lib/utils';
import { isSupportChatBlocked } from '@/lib/platformSync';
import { SUPPORT_CHAT_LEGACY_KEY, supportChatStorageKey } from '@/lib/tenant-local-storage';
import { pushToast } from '@/lib/toast';

const MAX_IMAGES_PER_MSG = 6;

export type SupportMessage = {
  id: string;
  role: 'user' | 'system';
  text: string;
  images: string[];
  ts: number;
};

const WELCOME: SupportMessage = {
  id: 'welcome',
  role: 'system',
  text: 'Здравствуйте! Опишите проблему или прикрепите скриншоты — при включённом API сообщения сохраняются на сервере; иначе только в этом браузере.',
  images: [],
  ts: Date.now(),
};

function migrateLegacyChatToTenant(tenantId: string): SupportMessage[] | null {
  if (typeof window === 'undefined' || !tenantId.trim()) return null;
  try {
    const raw = localStorage.getItem(SUPPORT_CHAT_LEGACY_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as SupportMessage[];
    if (!Array.isArray(p) || p.length === 0) {
      localStorage.removeItem(SUPPORT_CHAT_LEGACY_KEY);
      return null;
    }
    localStorage.setItem(supportChatStorageKey(tenantId), raw);
    localStorage.removeItem(SUPPORT_CHAT_LEGACY_KEY);
    return p;
  } catch {
    return null;
  }
}

function loadMessages(tenantId: string): SupportMessage[] {
  if (typeof window === 'undefined' || !tenantId.trim()) return [WELCOME];
  try {
    const key = supportChatStorageKey(tenantId);
    let raw = localStorage.getItem(key);
    if (!raw) {
      const migrated = migrateLegacyChatToTenant(tenantId);
      if (migrated) return migrated;
    } else {
      const p = JSON.parse(raw) as SupportMessage[];
      if (Array.isArray(p) && p.length > 0) return p;
    }
  } catch {
    /* ignore */
  }
  return [WELCOME];
}

function saveMessages(tenantId: string, msgs: SupportMessage[]) {
  if (!tenantId.trim()) return;
  try {
    localStorage.setItem(supportChatStorageKey(tenantId), JSON.stringify(msgs));
  } catch {
    /* quota */
  }
}

export function SupportChat() {
  const apiBase = getApiBaseUrl();
  const [tenantId, setTenantId] = useState(() => getTenantIdClient());
  const [messages, setMessages] = useState<SupportMessage[]>([WELCOME]);
  const [draft, setDraft] = useState('');
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [chatBlocked, setChatBlocked] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const syncTid = () => setTenantId(getTenantIdClient());
    syncTid();
    window.addEventListener('focus', syncTid);
    window.addEventListener('storage', syncTid);
    window.addEventListener('linearize-tenant-auth', syncTid);
    return () => {
      window.removeEventListener('focus', syncTid);
      window.removeEventListener('storage', syncTid);
      window.removeEventListener('linearize-tenant-auth', syncTid);
    };
  }, []);

  useEffect(() => {
    const tid = tenantId.trim();
    if (!tid) {
      setMessages([WELCOME]);
      return;
    }
    if (!apiBase) {
      setMessages(loadMessages(tid));
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await apiFetchJson<SupportMessage[]>(
        `${apiBase}/v1/tenant/${tid}/support-chat`,
        { headers: tenantFetchHeaders(), silent: true, retries: 2 }
      );
      if (cancelled) return;
      if (getTenantIdClient().trim() !== tid) return;
      if (res.ok && Array.isArray(res.data)) {
        setMessages(res.data.length > 0 ? res.data : [WELCOME]);
      } else {
        setMessages([WELCOME]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiBase, tenantId]);

  /** Подтягиваем ответы поддержки с сервера без перезагрузки страницы. */
  useEffect(() => {
    if (!apiBase || !tenantId.trim()) return;
    const tick = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      void (async () => {
        const current = getTenantIdClient().trim();
        if (!current || current !== tenantId.trim()) return;
        const res = await apiFetchJson<SupportMessage[]>(
          `${apiBase}/v1/tenant/${tenantId}/support-chat`,
          { headers: tenantFetchHeaders(), silent: true, retries: 1 }
        );
        if (getTenantIdClient().trim() !== tenantId.trim()) return;
        if (res.ok && Array.isArray(res.data)) {
          setMessages(res.data.length > 0 ? res.data : [WELCOME]);
        }
      })();
    };
    const id = window.setInterval(tick, 12_000);
    return () => clearInterval(id);
  }, [apiBase, tenantId]);

  useEffect(() => {
    const syncBlock = () => {
      if (getApiBaseUrl()) {
        void (async () => {
          try {
            const base = getApiBaseUrl();
            if (!base) {
              setChatBlocked(isSupportChatBlocked());
              return;
            }
            const res = await apiFetchJson<{ supportChatBlocked?: boolean }>(
              `${base}/v1/tenant/${getTenantIdClient()}/workspace-meta`,
              { headers: tenantFetchHeaders(), silent: true, retries: 1 }
            );
            if (res.ok) {
              setChatBlocked(!!res.data.supportChatBlocked);
              return;
            }
          } catch {
            /* ignore */
          }
          setChatBlocked(isSupportChatBlocked());
        })();
      } else {
        setChatBlocked(isSupportChatBlocked());
      }
    };
    syncBlock();
    window.addEventListener('storage', syncBlock);
    window.addEventListener('focus', syncBlock);
    return () => {
      window.removeEventListener('storage', syncBlock);
      window.removeEventListener('focus', syncBlock);
    };
  }, [tenantId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const appendMessage = useCallback((msg: SupportMessage) => {
    setMessages((prev) => {
      const next = [...prev, msg];
      const tid = getTenantIdClient().trim();
      if (!getApiBaseUrl() && tid) saveMessages(tid, next);
      return next;
    });
  }, []);

  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (chatBlocked) return;
    const files = e.target.files;
    if (!files?.length) return;
    const remaining = MAX_IMAGES_PER_MSG - pendingImages.length;
    const take = Array.from(files).slice(0, Math.max(0, remaining));
    take.forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = () => {
        const url = reader.result as string;
        setPendingImages((prev) => [...prev, url].slice(0, MAX_IMAGES_PER_MSG));
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removePending = (idx: number) => {
    setPendingImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const send = () => {
    if (chatBlocked) return;
    const t = draft.trim();
    if (!t && pendingImages.length === 0) return;
    const msg: SupportMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text: t || (pendingImages.length ? 'Фото' : ''),
      images: [...pendingImages],
      ts: Date.now(),
    };
    setDraft('');
    setPendingImages([]);

    const base = getApiBaseUrl();
    const apiTid = getTenantIdClient().trim();
    if (base) {
      if (!apiTid) {
        pushToast('Нет организации — войдите снова', 'error');
        return;
      }
      setMessages((prev) => [...prev, msg]);
      void (async () => {
        const pushSystem = async (text: string) => {
          const sm: SupportMessage = {
            id: crypto.randomUUID(),
            role: 'system',
            text,
            images: [],
            ts: Date.now(),
          };
          setMessages((prev) => [...prev, sm]);
          void apiFetchJson(`${base}/v1/tenant/${apiTid}/support-chat`, {
            method: 'POST',
            headers: jsonTenantHeaders(),
            body: JSON.stringify({ role: 'system', text: sm.text, images: [] }),
            silent: true,
            retries: 0,
          });
        };
        const userRes = await apiFetchJson(`${base}/v1/tenant/${apiTid}/support-chat`, {
          method: 'POST',
          headers: jsonTenantHeaders(),
          body: JSON.stringify({
            role: 'user',
            text: msg.text,
            images: msg.images,
          }),
          silent: true,
          retries: 1,
        });
        if (getTenantIdClient().trim() !== apiTid) return;
        if (userRes.ok) {
          await pushSystem('Сообщение получено и передано в очередь поддержки платформы.');
        } else {
          pushToast(userRes.error || 'Не удалось отправить сообщение', 'error');
          await pushSystem('Не удалось отправить сообщение на сервер. Проверьте API и ключ.');
        }
      })();
      return;
    }

    appendMessage(msg);
    window.setTimeout(() => {
      appendMessage({
        id: crypto.randomUUID(),
        role: 'system',
        text: 'Сообщение получено. Включите NEXT_PUBLIC_API_URL для сохранения на сервере.',
        images: [],
        ts: Date.now(),
      });
    }, 600);
  };

  const clearHistory = () => {
    if (!confirm('Очистить историю чата?')) return;
    const base = getApiBaseUrl();
    if (base) {
      const delTid = getTenantIdClient().trim();
      if (!delTid) {
        pushToast('Нет организации — войдите снова', 'error');
        return;
      }
      void (async () => {
        const res = await apiFetchJson<SupportMessage[]>(`${base}/v1/tenant/${delTid}/support-chat`, {
          method: 'DELETE',
          headers: tenantFetchHeaders(),
          silent: true,
          retries: 1,
        });
        if (getTenantIdClient().trim() !== delTid) return;
        if (res.ok) {
          if (Array.isArray(res.data)) setMessages(res.data);
        } else pushToast(res.error, 'error');
      })();
      return;
    }
    const tid = tenantId.trim();
    if (tid) localStorage.removeItem(supportChatStorageKey(tid));
    localStorage.removeItem(SUPPORT_CHAT_LEGACY_KEY);
    setMessages(tid ? loadMessages(tid) : [WELCOME]);
  };

  const canSend = useMemo(
    () => !chatBlocked && (draft.trim().length > 0 || pendingImages.length > 0),
    [chatBlocked, draft, pendingImages.length]
  );

  return (
    <div className="flex-1 min-h-0 min-w-0 flex flex-col w-full max-w-3xl mx-auto px-4 sm:px-6 py-4 sm:py-6 overflow-x-hidden">
      {chatBlocked ? (
        <div className="mb-4 rounded-xl border border-red-500/35 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          Чат техподдержки для этого аккаунта <strong className="text-white">заблокирован</strong>{' '}
          администратором платформы. Напишите на почту или дождитесь разблокировки.
        </div>
      ) : null}

      <div className="flex items-start justify-between gap-4 mb-4 shrink-0">
        <div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-[#71717a] font-semibold mb-1">
            <Headphones className="w-4 h-4 text-[#3b82f6]" />
            Техподдержка
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">
            Чат с администратором
          </h1>
          <p className="text-sm text-[#a1a1aa] mt-1 max-w-xl">
            Пишите текст и прикрепляйте скриншоты — до {MAX_IMAGES_PER_MSG} фото за раз.
          </p>
        </div>
        <button
          type="button"
          onClick={clearHistory}
          className="flex items-center gap-1.5 text-xs text-[#71717a] hover:text-[#a1a1aa] px-2 py-1.5 rounded-lg border border-transparent hover:border-[#27272a] shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Очистить
        </button>
      </div>

      <div
        ref={listRef}
        className={cn(
          'flex-1 min-h-[200px] overflow-y-auto rounded-xl border border-[#1f1f22] bg-[#121214]/80 p-4 space-y-4 custom-scrollbar mb-3',
          chatBlocked && 'opacity-50 pointer-events-none'
        )}
      >
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              'flex',
              m.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            <div
              className={cn(
                'max-w-[min(100%,28rem)] rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed',
                m.role === 'user'
                  ? 'bg-[#2563eb]/20 text-[#e4e4e7] border border-[#2563eb]/30'
                  : 'bg-[#1f1f22] text-[#d4d4d8] border border-[#27272a]'
              )}
            >
              {m.text ? <p className="whitespace-pre-wrap break-words">{m.text}</p> : null}
              {m.images.length > 0 && (
                <div className={cn('flex flex-wrap gap-2', m.text ? 'mt-2' : '')}>
                  {m.images.map((src, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={i}
                      src={src}
                      alt=""
                      className="max-h-48 rounded-lg border border-[#27272a] object-contain bg-black/30"
                    />
                  ))}
                </div>
              )}
              <div className="text-[10px] text-[#71717a] mt-2 opacity-80">
                {new Date(m.ts).toLocaleString('ru-RU', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {pendingImages.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2 shrink-0">
          {pendingImages.map((src, i) => (
            <div key={i} className="relative group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt=""
                className="h-16 w-16 rounded-lg object-cover border border-[#27272a]"
              />
              <button
                type="button"
                onClick={() => removePending(i)}
                className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#27272a] text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Убрать"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2 shrink-0">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={onPickFiles}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={chatBlocked || pendingImages.length >= MAX_IMAGES_PER_MSG}
          className="flex items-center justify-center gap-2 sm:w-11 h-11 rounded-xl border border-[#27272a] bg-[#1f1f22] text-[#a1a1aa] hover:bg-[#27272a] hover:text-white disabled:opacity-40 shrink-0"
          title="Прикрепить фото"
        >
          <ImagePlus className="w-5 h-5" />
          <span className="sm:hidden text-sm">Фото</span>
        </button>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (canSend) send();
            }
          }}
          placeholder="Сообщение… (Enter — отправить, Shift+Enter — новая строка)"
          rows={2}
          disabled={chatBlocked}
          className="flex-1 min-w-0 resize-none rounded-xl border border-[#27272a] bg-[#0a0a0c] text-[14px] text-[#e4e4e7] placeholder:text-[#52525b] px-3 py-2.5 outline-none focus:border-[#3b82f6]/50 min-h-[44px] max-h-32 disabled:opacity-50"
        />
        <button
          type="button"
          onClick={send}
          disabled={!canSend || chatBlocked}
          className="flex items-center justify-center gap-2 h-11 sm:h-auto sm:px-6 rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] disabled:opacity-40 disabled:hover:bg-[#2563eb] text-white text-sm font-semibold shrink-0"
        >
          <Send className="w-4 h-4" />
          Отправить
        </button>
      </div>
    </div>
  );
}
