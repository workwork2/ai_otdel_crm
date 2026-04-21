'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, Eye, Snowflake, Sun, MessageCircle, MessageCircleOff } from 'lucide-react';
import { getApiBaseUrl, jsonSuperHeaders, superFetchHeaders } from '@/lib/backend-api';
import { cn } from '@/lib/utils';
import {
  SUPER_TENANTS,
  type SuperTenant,
  type TenantStatus,
  setImpersonation,
  readTenantOverrides,
  writeTenantOverrides,
  readChatBlocks,
  writeChatBlocks,
} from '@/lib/superAdminData';

const STATUS_LABEL: Record<TenantStatus, string> = {
  trial: 'Trial',
  active: 'Активен',
  past_due: 'Просрочка',
  frozen: 'Заморожен',
};

type TenantRow = SuperTenant & { chatBlocked: boolean; planKey?: string | null };

const PLAN_QUICK: { key: string; label: string }[] = [
  { key: 'trial', label: 'Trial' },
  { key: 'starter', label: 'Starter' },
  { key: 'business_plus', label: 'Business+' },
  { key: 'pro', label: 'Pro' },
  { key: 'enterprise', label: 'Enterprise' },
];

function statusBadge(status: TenantStatus) {
  const map: Record<TenantStatus, string> = {
    trial: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    active: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    past_due: 'bg-amber-500/15 text-amber-200 border-amber-500/35',
    frozen: 'bg-zinc-600/40 text-zinc-300 border-zinc-500/30',
  };
  return map[status];
}

export function SuperTenants() {
  const apiBase = getApiBaseUrl();
  const [overrides, setOverrides] = useState<Record<string, TenantStatus>>({});
  const [chatBlocked, setChatBlocked] = useState<Record<string, boolean>>({});
  const [apiTenants, setApiTenants] = useState<TenantRow[] | null>(null);

  useEffect(() => {
    if (apiBase) {
      void (async () => {
        try {
          const r = await fetch(`${apiBase}/v1/super/tenants`, { headers: superFetchHeaders() });
          if (r.ok) {
            const data = (await r.json()) as TenantRow[];
            if (Array.isArray(data)) setApiTenants(data);
          }
        } catch {
          setApiTenants(null);
        }
      })();
      return;
    }
    setOverrides(readTenantOverrides());
    setChatBlocked(readChatBlocks());
    setApiTenants(null);
  }, [apiBase]);

  const tenants = useMemo((): TenantRow[] => {
    if (apiTenants) return apiTenants;
    return SUPER_TENANTS.map((t) => ({
      ...t,
      status: overrides[t.id] ?? t.status,
      chatBlocked: chatBlocked[t.id] ?? false,
    }));
  }, [apiTenants, overrides, chatBlocked]);

  const refreshApiTenants = useCallback(async () => {
    if (!apiBase) return;
    try {
      const r = await fetch(`${apiBase}/v1/super/tenants`, { headers: superFetchHeaders() });
      if (r.ok) {
        const data = (await r.json()) as TenantRow[];
        if (Array.isArray(data)) setApiTenants(data);
      }
    } catch {
      /* ignore */
    }
  }, [apiBase]);

  const patchPlan = useCallback(
    async (id: string, planKey: string) => {
      if (!apiBase) return;
      try {
        await fetch(`${apiBase}/v1/super/tenants/${id}/plan`, {
          method: 'PATCH',
          headers: jsonSuperHeaders(),
          body: JSON.stringify({ planKey }),
        });
        await refreshApiTenants();
      } catch {
        /* ignore */
      }
    },
    [apiBase, refreshApiTenants]
  );

  const setStatus = useCallback(
    (id: string, status: TenantStatus) => {
      if (apiBase) {
        void (async () => {
          await fetch(`${apiBase}/v1/super/tenants/${id}/status`, {
            method: 'PATCH',
            headers: jsonSuperHeaders(),
            body: JSON.stringify({ status }),
          }).catch(() => {});
          await refreshApiTenants();
        })();
        return;
      }
      setOverrides((prev) => {
        const base = { ...prev };
        const orig = SUPER_TENANTS.find((x) => x.id === id)?.status;
        if (status === orig) delete base[id];
        else base[id] = status;
        writeTenantOverrides(base);
        return base;
      });
    },
    [apiBase, refreshApiTenants]
  );

  const toggleChat = useCallback(
    (id: string, blocked: boolean) => {
      if (apiBase) {
        void (async () => {
          await fetch(`${apiBase}/v1/super/tenants/${id}/chat-block`, {
            method: 'PATCH',
            headers: jsonSuperHeaders(),
            body: JSON.stringify({ blocked }),
          }).catch(() => {});
          await refreshApiTenants();
        })();
        return;
      }
      setChatBlocked((prev) => {
        const base = { ...prev };
        if (!blocked) delete base[id];
        else base[id] = true;
        writeChatBlocks(base);
        return { ...base };
      });
    },
    [apiBase, refreshApiTenants]
  );

  const impersonate = (t: SuperTenant) => {
    setImpersonation({ tenantId: t.id, tenantName: t.name });
    const origin = (
      typeof process !== 'undefined' && process.env.NEXT_PUBLIC_USER_APP_URL
        ? process.env.NEXT_PUBLIC_USER_APP_URL
        : 'http://localhost:3000'
    ).replace(/\/$/, '');
    window.location.href = `${origin}/`;
  };

  return (
    <div className="sa-page flex-1 min-h-0 overflow-y-auto w-full max-w-6xl mx-auto px-4 sm:px-8 lg:px-10 py-8 space-y-6">
      <div className="sa-glow-line max-w-md opacity-80" />
      <div>
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-amber-600/90 font-bold mb-2">
          <Building2 className="w-4 h-4 text-amber-400" />
          Tenants
        </div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight">
          Управление клиентами
        </h1>
        <p className="text-zinc-400 mt-2 text-[15px] max-w-2xl leading-relaxed">
          Подписка, тарифы, заморозка за неуплату, блокировка чата техподдержки в панели клиента, вход без
          пароля (impersonation).
        </p>
      </div>

      <div className="sa-card overflow-hidden rounded-xl border border-zinc-700/50">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[960px]">
            <thead className="bg-zinc-900/60 text-[11px] uppercase tracking-wider text-zinc-500 border-b border-zinc-800/80">
              <tr>
                <th className="px-4 py-3 font-semibold">Организация</th>
                <th className="px-4 py-3 font-semibold">Статус</th>
                <th className="px-4 py-3 font-semibold">Регистрация</th>
                <th className="px-4 py-3 font-semibold">Тариф</th>
                <th className="px-4 py-3 font-semibold text-right">MRR</th>
                <th className="px-4 py-3 font-semibold">Чат ТП</th>
                <th className="px-4 py-3 font-semibold text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80">
              {tenants.map((t) => (
                <tr key={t.id} className="hover:bg-zinc-900/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{t.name}</div>
                    <div className="text-[11px] text-zinc-500 font-mono">{t.slug}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex text-[11px] font-semibold px-2 py-0.5 rounded-md border',
                        statusBadge(t.status)
                      )}
                    >
                      {STATUS_LABEL[t.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-400 tabular-nums">
                    {new Date(t.registeredAt).toLocaleDateString('ru-RU')}
                  </td>
                  <td className="px-4 py-3 text-zinc-300">
                    {apiBase ? (
                      <select
                        value={t.planKey ?? 'starter'}
                        onChange={(e) => void patchPlan(t.id, e.target.value)}
                        className="bg-zinc-900/80 border border-zinc-700 rounded-md text-[11px] text-zinc-200 px-2 py-1.5 max-w-[9.5rem] cursor-pointer"
                        aria-label={`Тариф ${t.name}`}
                      >
                        {PLAN_QUICK.map((p) => (
                          <option key={p.key} value={p.key}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      t.plan
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-white">
                    {t.mrrRub > 0 ? `₽ ${t.mrrRub.toLocaleString('ru-RU')}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleChat(t.id, !t.chatBlocked)}
                      className={cn(
                        'inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors',
                        t.chatBlocked
                          ? 'bg-red-950/40 text-red-300 border-red-800/50 hover:bg-red-950/60'
                          : 'bg-emerald-950/30 text-emerald-300 border-emerald-800/40 hover:bg-emerald-950/50'
                      )}
                      title={
                        t.chatBlocked
                          ? 'Разблокировать чат поддержки у клиента'
                          : 'Заблокировать чат (например, злоупотребления)'
                      }
                    >
                      {t.chatBlocked ? (
                        <>
                          <MessageCircleOff className="w-3.5 h-3.5" /> Заблокирован
                        </>
                      ) : (
                        <>
                          <MessageCircle className="w-3.5 h-3.5" /> Открыт
                        </>
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => impersonate(t)}
                        className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-violet-500/15 text-violet-300 border border-violet-500/30 hover:bg-violet-500/25"
                        title="Войти как клиент"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Войти как
                      </button>
                      {t.status === 'frozen' ? (
                        <button
                          type="button"
                          onClick={() => setStatus(t.id, 'active')}
                          className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 hover:bg-emerald-500/25"
                        >
                          <Sun className="w-3.5 h-3.5" />
                          Разморозить
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setStatus(t.id, 'frozen')}
                          className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-zinc-800 text-zinc-200 border border-zinc-600 hover:bg-zinc-700"
                        >
                          <Snowflake className="w-3.5 h-3.5" />
                          Заморозить
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-zinc-600 max-w-3xl">
        {apiBase ? (
          <>
            Данные tenants с API <span className="font-mono text-[11px]">{apiBase}</span>. Impersonation —{' '}
            <span className="font-mono text-[11px]">sessionStorage</span> в панели клиента.
          </>
        ) : (
          <>
            Демо без API: статусы и блокировки в <span className="font-mono text-[11px]">localStorage</span>.
            Impersonation — <span className="font-mono text-[11px]">sessionStorage</span>.
          </>
        )}
      </p>
    </div>
  );
}
