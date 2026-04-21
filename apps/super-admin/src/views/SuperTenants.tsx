'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Eye,
  Snowflake,
  Sun,
  MessageCircle,
  MessageCircleOff,
  UserPlus,
  Loader2,
  CalendarClock,
  KeyRound,
  Copy,
  Wand2,
} from 'lucide-react';
import { PasswordInput } from '@/components/PasswordInput';
import { NativeSelect } from '@/components/NativeSelect';
import { getApiBaseUrl, jsonSuperHeaders, superFetchHeaders } from '@/lib/backend-api';
import { cn } from '@/lib/utils';
import { type SuperTenant, type TenantStatus } from '@/lib/superAdminData';

const STATUS_LABEL: Record<TenantStatus, string> = {
  trial: 'Trial',
  active: 'Активен',
  past_due: 'Просрочка',
  frozen: 'Заморожен',
};

type TenantRow = SuperTenant & {
  chatBlocked: boolean;
  planKey?: string | null;
  validUntil?: string | null;
  subscriptionExpired?: boolean;
  subscriptionDaysRemaining?: number | null;
  portalAccessConfigured?: boolean;
};

const PLAN_QUICK: { key: string; label: string }[] = [
  { key: 'trial', label: 'Trial' },
  { key: 'starter', label: 'Starter' },
  { key: 'business_plus', label: 'Business+' },
  { key: 'pro', label: 'Pro' },
  { key: 'enterprise', label: 'Enterprise' },
];

/** Как на бэкенде: латиница, цифры, дефис. */
function normalizeTenantSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function randomPortalPassword(len = 14): string {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  let s = '';
  for (let i = 0; i < len; i++) s += chars[arr[i]! % chars.length];
  return s;
}

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
  const [apiTenants, setApiTenants] = useState<TenantRow[] | null>(null);
  const [cName, setCName] = useState('');
  const [cSlug, setCSlug] = useState('');
  const [cPlan, setCPlan] = useState('trial');
  const [creating, setCreating] = useState(false);
  const [orgErr, setOrgErr] = useState<string | null>(null);
  const [orgOk, setOrgOk] = useState<string | null>(null);
  const [portalPwdDraft, setPortalPwdDraft] = useState<Record<string, string>>({});
  /** После успешного сохранения показываем plaintext до «Скрыть», чтобы можно было скопировать. */
  const [portalPwdReveal, setPortalPwdReveal] = useState<Record<string, string>>({});
  const [portalErr, setPortalErr] = useState<Record<string, string>>({});
  const [portalOk, setPortalOk] = useState<Record<string, string>>({});
  const [savingPortalId, setSavingPortalId] = useState<string | null>(null);
  const [copyFlash, setCopyFlash] = useState<string | null>(null);

  useEffect(() => {
    if (!apiBase) {
      setApiTenants(null);
      return;
    }
    void (async () => {
      try {
        const r = await fetch(`${apiBase}/v1/super/tenants`, { headers: superFetchHeaders() });
        if (r.ok) {
          const data = (await r.json()) as TenantRow[];
          setApiTenants(Array.isArray(data) ? data : []);
        } else {
          setApiTenants([]);
        }
      } catch {
        setApiTenants([]);
      }
    })();
  }, [apiBase]);

  const tenantsLoading = !!apiBase && apiTenants === null;
  const tenants = useMemo((): TenantRow[] => {
    if (!apiBase) return [];
    return apiTenants ?? [];
  }, [apiBase, apiTenants]);

  const normalizedCreateSlug = useMemo(() => normalizeTenantSlug(cSlug), [cSlug]);
  const createSlugOk = normalizedCreateSlug.length > 0 && normalizedCreateSlug.length <= 128;
  const createNameOk = cName.trim().length > 0 && cName.trim().length <= 200;

  const refreshApiTenants = useCallback(async () => {
    if (!apiBase) return;
    try {
      const r = await fetch(`${apiBase}/v1/super/tenants`, { headers: superFetchHeaders() });
      if (r.ok) {
        const data = (await r.json()) as TenantRow[];
        setApiTenants(Array.isArray(data) ? data : []);
      } else {
        setApiTenants([]);
      }
    } catch {
      setApiTenants([]);
    }
  }, [apiBase]);

  const copyText = useCallback(async (tenantId: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyFlash(tenantId);
      setTimeout(() => setCopyFlash((id) => (id === tenantId ? null : id)), 2000);
    } catch {
      setPortalErr((e) => ({ ...e, [tenantId]: 'Не удалось скопировать — разрешите буфер обмена в браузере.' }));
    }
  }, []);

  const savePortalPassword = useCallback(
    async (id: string) => {
      if (!apiBase) return;
      const password = (portalPwdDraft[id] ?? '').trim();
      if (password.length < 8) {
        setPortalErr((s) => ({ ...s, [id]: 'Минимум 8 символов' }));
        setPortalOk((s) => {
          const n = { ...s };
          delete n[id];
          return n;
        });
        return;
      }
      setSavingPortalId(id);
      setPortalErr((s) => {
        const n = { ...s };
        delete n[id];
        return n;
      });
      try {
        const r = await fetch(`${apiBase}/v1/super/tenants/${id}/portal-password`, {
          method: 'PATCH',
          headers: jsonSuperHeaders(),
          body: JSON.stringify({ password }),
        });
        if (!r.ok) {
          const data = (await r.json().catch(() => ({}))) as { message?: string | string[] };
          const msg = Array.isArray(data.message) ? data.message.join(', ') : data.message;
          setPortalErr((s) => ({ ...s, [id]: msg || `Ошибка ${r.status}` }));
          setPortalOk((s) => {
            const n = { ...s };
            delete n[id];
            return n;
          });
          return;
        }
        setPortalPwdReveal((s) => ({ ...s, [id]: password }));
        setPortalPwdDraft((s) => ({ ...s, [id]: '' }));
        setPortalOk((s) => ({
          ...s,
          [id]: 'Сохранено в базу. Пароль показан ниже — скопируйте и нажмите «Скрыть», когда закончите.',
        }));
        await refreshApiTenants();
      } catch {
        setPortalErr((s) => ({ ...s, [id]: 'Сеть или API недоступен' }));
      } finally {
        setSavingPortalId(null);
      }
    },
    [apiBase, portalPwdDraft, refreshApiTenants]
  );

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
      if (!apiBase) return;
      void (async () => {
        await fetch(`${apiBase}/v1/super/tenants/${id}/status`, {
          method: 'PATCH',
          headers: jsonSuperHeaders(),
          body: JSON.stringify({ status }),
        }).catch(() => {});
        await refreshApiTenants();
      })();
    },
    [apiBase, refreshApiTenants]
  );

  const toggleChat = useCallback(
    (id: string, blocked: boolean) => {
      if (!apiBase) return;
      void (async () => {
        await fetch(`${apiBase}/v1/super/tenants/${id}/chat-block`, {
          method: 'PATCH',
          headers: jsonSuperHeaders(),
          body: JSON.stringify({ blocked }),
        }).catch(() => {});
        await refreshApiTenants();
      })();
    },
    [apiBase, refreshApiTenants]
  );

  const [extendingId, setExtendingId] = useState<string | null>(null);

  const grantComplimentaryDays = useCallback(
    async (id: string, days: 3 | 7 | 30) => {
      if (!apiBase) return;
      setExtendingId(id);
      try {
        const r = await fetch(`${apiBase}/v1/super/tenants/${id}/subscription-extend`, {
          method: 'PATCH',
          headers: jsonSuperHeaders(),
          body: JSON.stringify({ days }),
        });
        if (r.ok) await refreshApiTenants();
      } catch {
        /* ignore */
      } finally {
        setExtendingId(null);
      }
    },
    [apiBase, refreshApiTenants]
  );

  const createOrganization = useCallback(async () => {
    setOrgErr(null);
    setOrgOk(null);
    if (!apiBase) return;
    setCreating(true);
    try {
      const r = await fetch(`${apiBase}/v1/platform/tenants`, {
        method: 'POST',
        headers: jsonSuperHeaders(),
        body: JSON.stringify({
          name: cName.trim(),
          slug: cSlug.trim(),
          planKey: cPlan,
        }),
      });
      const data = (await r.json().catch(() => ({}))) as {
        id?: string;
        message?: string | string[];
      };
      if (!r.ok) {
        const msg = Array.isArray(data.message) ? data.message.join(', ') : data.message;
        setOrgErr(msg || `Ошибка ${r.status}`);
        return;
      }
      setOrgOk(`Создана организация ${data.id ?? ''}. Задайте пароль CRM в таблице ниже.`);
      setCName('');
      setCSlug('');
      setCPlan('trial');
      await refreshApiTenants();
    } catch {
      setOrgErr('Сеть или API недоступен — проверьте, что Nest запущен и NEXT_PUBLIC_API_URL верный.');
    } finally {
      setCreating(false);
    }
  }, [apiBase, cName, cSlug, cPlan, refreshApiTenants]);

  const impersonate = async (t: SuperTenant) => {
    if (!apiBase) return;
    setOrgErr(null);
    try {
      const r = await fetch(`${apiBase}/v1/super/tenants/${t.id}/portal-impersonation-code`, {
        method: 'POST',
        headers: superFetchHeaders(),
      });
      const data = (await r.json().catch(() => ({}))) as { loginUrl?: string; message?: string | string[] };
      if (!r.ok) {
        const msg = Array.isArray(data.message) ? data.message.join(', ') : data.message;
        setOrgErr(msg || `Ошибка ${r.status}`);
        return;
      }
      if (data.loginUrl) {
        window.location.href = data.loginUrl;
        return;
      }
      setOrgErr('Нет loginUrl в ответе');
    } catch {
      setOrgErr('Сеть или API недоступен');
    }
  };

  if (!apiBase) {
    return (
      <div className="sa-page flex-1 min-h-0 overflow-y-auto w-full max-w-6xl mx-auto px-4 sm:px-8 lg:px-10 py-8">
        <p className="text-sm text-zinc-400 leading-relaxed">
          Задайте <code className="text-xs text-zinc-300 font-mono">NEXT_PUBLIC_API_URL</code> — список организаций
          загружается только с API.
        </p>
      </div>
    );
  }

  return (
    <div className="sa-page flex-1 min-h-0 overflow-y-auto w-full max-w-6xl mx-auto px-4 sm:px-8 lg:px-10 py-8 space-y-6">
      <div className="sa-glow-line max-w-md opacity-80" />
      <div>
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-amber-600/90 font-bold mb-2">
          <Building2 className="w-4 h-4 text-amber-400" />
          Tenants
        </div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight text-balance">
          Управление клиентами
        </h1>
        <p className="text-zinc-400 mt-2 text-[15px] max-w-2xl leading-relaxed">
          Подписка, тарифы, продление, заморозка, блокировка чата. Пароль CRM задаётся отдельно от вашего входа в
          эту панель — сгенерируйте строку, скопируйте клиенту и нажмите «Сохранить».
        </p>
      </div>

      <div className="sa-card rounded-xl border border-amber-500/25 bg-amber-950/20 p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2 text-amber-200/90 text-sm font-semibold">
          <UserPlus className="w-4 h-4 shrink-0" />
          Новая организация
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <input
            placeholder="Название"
            value={cName}
            onChange={(e) => {
              setCName(e.target.value);
              setOrgErr(null);
            }}
            autoComplete="organization"
            className="min-w-0 rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 leading-normal"
          />
          <div className="min-w-0 space-y-1">
            <input
              placeholder="slug (латиница, my-shop)"
              value={cSlug}
              onChange={(e) => {
                setCSlug(e.target.value);
                setOrgErr(null);
              }}
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 font-mono text-[13px]"
            />
            {cSlug.trim() ? (
              <p className="text-[10px] text-zinc-500 font-mono leading-snug break-all">
                В базе:{' '}
                <span className={createSlugOk ? 'text-zinc-400' : 'text-red-400'}>{normalizedCreateSlug || '—'}</span>
                {!createSlugOk && normalizedCreateSlug.length > 128 ? ' (слишком длинно)' : null}
                {!createSlugOk && !normalizedCreateSlug ? ' (пусто после нормализации — используйте латиницу)' : null}
              </p>
            ) : null}
          </div>
          <NativeSelect
            size="md"
            className="min-w-0 w-full xl:w-auto xl:min-w-[140px]"
            value={cPlan}
            onChange={(e) => setCPlan(e.target.value)}
            aria-label="Тариф новой организации"
          >
            {PLAN_QUICK.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </NativeSelect>
          <button
            type="button"
            disabled={creating || !createNameOk || !createSlugOk}
            onClick={() => void createOrganization()}
            title={
              !createNameOk || !createSlugOk
                ? 'Заполните название и корректный slug (латиница, до 128 символов после нормализации)'
                : undefined
            }
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500/90 text-zinc-950 font-semibold text-sm py-2.5 disabled:opacity-40 disabled:pointer-events-none min-h-[44px]"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Создать
          </button>
        </div>
        {orgErr ? <p className="text-sm text-red-400 leading-snug">{orgErr}</p> : null}
        {orgOk ? <p className="text-sm text-emerald-400 leading-snug">{orgOk}</p> : null}
      </div>

      <div className="sa-card overflow-hidden rounded-xl border border-zinc-700/50">
        <div className="overflow-x-auto -mx-px">
          {tenantsLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-zinc-500">
              <Loader2 className="w-5 h-5 animate-spin" />
              Загрузка организаций…
            </div>
          ) : null}
          {!tenantsLoading ? (
            <table className="w-full text-left text-sm min-w-[960px]">
              <thead className="bg-zinc-900/60 text-[11px] uppercase tracking-wider text-zinc-500 border-b border-zinc-800/80">
                <tr>
                  <th className="px-3 sm:px-4 py-3 font-semibold">Организация</th>
                  <th className="px-3 sm:px-4 py-3 font-semibold min-w-[220px]">Пароль CRM</th>
                  <th className="px-3 sm:px-4 py-3 font-semibold">Статус</th>
                  <th className="px-3 sm:px-4 py-3 font-semibold">Регистрация</th>
                  <th className="px-3 sm:px-4 py-3 font-semibold">Тариф</th>
                  <th className="px-3 sm:px-4 py-3 font-semibold">Подписка</th>
                  <th className="px-3 sm:px-4 py-3 font-semibold text-right">MRR</th>
                  <th className="px-3 sm:px-4 py-3 font-semibold">Чат ТП</th>
                  <th className="px-3 sm:px-4 py-3 font-semibold text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80">
                {tenants.map((t) => (
                  <tr key={t.id} className="hover:bg-zinc-900/40 transition-colors">
                    <td className="px-3 sm:px-4 py-3 align-top">
                      <div className="font-medium text-white leading-snug">{t.name}</div>
                      <div className="text-[11px] text-zinc-500 font-mono">{t.slug}</div>
                      <div className="text-[10px] text-zinc-600 font-mono mt-0.5 break-all">{t.id}</div>
                    </td>
                    <td className="px-3 sm:px-4 py-3 align-top">
                      <div className="flex flex-col gap-2 min-w-0 max-w-[280px]">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md border w-fit',
                            t.portalAccessConfigured
                              ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/50'
                              : 'bg-zinc-900 text-zinc-500 border-zinc-700'
                          )}
                        >
                          <KeyRound className="w-3 h-3" />
                          {t.portalAccessConfigured ? 'Пароль задан' : 'Нет пароля'}
                        </span>
                        <PasswordInput
                          placeholder="Новый пароль (8+)"
                          value={portalPwdDraft[t.id] ?? ''}
                          onChange={(e) => {
                            setPortalPwdDraft((s) => ({ ...s, [t.id]: e.target.value }));
                            setPortalErr((s) => {
                              const n = { ...s };
                              delete n[t.id];
                              return n;
                            });
                          }}
                          className="w-full"
                          inputClassName="text-[13px] py-2 px-2.5 pr-9 leading-normal"
                        />
                        <p className="text-[10px] text-zinc-500 leading-snug">
                          После «Сохранить» черновик в поле очищается; последний сохранённый пароль показывается отдельным
                          блоком, пока вы его не скроете. В базе хранится только хеш.
                        </p>
                        {portalPwdReveal[t.id] ? (
                          <div className="rounded-lg border border-emerald-800/50 bg-emerald-950/35 p-2.5 space-y-2">
                            <div className="text-[10px] text-emerald-200/90 font-medium uppercase tracking-wide">
                              Сохранённый пароль (только в этой вкладке)
                            </div>
                            <div className="font-mono text-[13px] text-white break-all select-all leading-snug">
                              {portalPwdReveal[t.id]}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              <button
                                type="button"
                                onClick={() => void copyText(t.id, portalPwdReveal[t.id] ?? '')}
                                className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md border border-emerald-600/50 bg-emerald-900/40 text-emerald-100 hover:bg-emerald-900/60"
                              >
                                <Copy className="w-3 h-3" />
                                {copyFlash === t.id ? 'Скопировано' : 'Копировать'}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setPortalPwdReveal((s) => {
                                    const n = { ...s };
                                    delete n[t.id];
                                    return n;
                                  })
                                }
                                className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md border border-zinc-600 bg-zinc-800/80 text-zinc-200 hover:bg-zinc-700"
                              >
                                Скрыть
                              </button>
                            </div>
                          </div>
                        ) : null}
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              const pwd = randomPortalPassword();
                              setPortalPwdDraft((s) => ({ ...s, [t.id]: pwd }));
                              setPortalPwdReveal((s) => {
                                const n = { ...s };
                                delete n[t.id];
                                return n;
                              });
                              setPortalErr((s) => {
                                const n = { ...s };
                                delete n[t.id];
                                return n;
                              });
                              setPortalOk((s) => {
                                const n = { ...s };
                                delete n[t.id];
                                return n;
                              });
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md border border-zinc-600 bg-zinc-800/80 text-zinc-200 hover:bg-zinc-700"
                          >
                            <Wand2 className="w-3 h-3" />
                            Сгенерировать
                          </button>
                          <button
                            type="button"
                            disabled={
                              !(portalPwdDraft[t.id] ?? '').trim() && !(portalPwdReveal[t.id] ?? '').trim()
                            }
                            onClick={() =>
                              void copyText(
                                t.id,
                                (portalPwdDraft[t.id] ?? '').trim() || (portalPwdReveal[t.id] ?? '')
                              )
                            }
                            className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md border border-zinc-600 bg-zinc-800/80 text-zinc-200 hover:bg-zinc-700 disabled:opacity-40"
                          >
                            <Copy className="w-3 h-3" />
                            {copyFlash === t.id ? 'Скопировано' : 'Копировать'}
                          </button>
                          <button
                            type="button"
                            disabled={savingPortalId === t.id}
                            onClick={() => void savePortalPassword(t.id)}
                            className="text-[11px] font-semibold rounded-md bg-amber-500/25 text-amber-100 border border-amber-500/40 px-2.5 py-1 hover:bg-amber-500/35 disabled:opacity-40"
                          >
                            {savingPortalId === t.id ? 'Сохранение…' : 'Сохранить'}
                          </button>
                        </div>
                        {portalErr[t.id] ? (
                          <p className="text-[11px] text-red-400 leading-snug">{portalErr[t.id]}</p>
                        ) : null}
                        {portalOk[t.id] ? (
                          <p className="text-[11px] text-emerald-400/90 leading-snug">{portalOk[t.id]}</p>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 sm:px-4 py-3 align-top">
                      <span
                        className={cn(
                          'inline-flex text-[11px] font-semibold px-2 py-0.5 rounded-md border',
                          statusBadge(t.status)
                        )}
                      >
                        {STATUS_LABEL[t.status]}
                      </span>
                    </td>
                    <td className="px-3 sm:px-4 py-3 text-zinc-400 tabular-nums align-top">
                      {new Date(t.registeredAt).toLocaleDateString('ru-RU')}
                    </td>
                    <td className="px-3 sm:px-4 py-3 text-zinc-300 align-top">
                      {apiBase ? (
                        <NativeSelect
                          size="sm"
                          className="max-w-[11rem]"
                          value={t.planKey ?? 'starter'}
                          onChange={(e) => void patchPlan(t.id, e.target.value)}
                          aria-label={`Тариф ${t.name}`}
                        >
                          {PLAN_QUICK.map((p) => (
                            <option key={p.key} value={p.key}>
                              {p.label}
                            </option>
                          ))}
                        </NativeSelect>
                      ) : (
                        t.plan
                      )}
                    </td>
                    <td className="px-3 sm:px-4 py-3 text-zinc-300 align-top">
                      {apiBase && t.validUntil ? (
                        <div className="space-y-2 max-w-[14rem]">
                          <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                            <CalendarClock className="w-3.5 h-3.5 shrink-0 text-amber-500/80" />
                            <span className="tabular-nums">
                              {new Date(t.validUntil).toLocaleDateString('ru-RU')}
                            </span>
                            {t.subscriptionExpired ? (
                              <span className="text-red-400 font-semibold">истекла</span>
                            ) : typeof t.subscriptionDaysRemaining === 'number' ? (
                              <span className="text-zinc-500">· {t.subscriptionDaysRemaining} дн.</span>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {([3, 7, 30] as const).map((d) => (
                              <button
                                key={d}
                                type="button"
                                disabled={extendingId === t.id}
                                onClick={() => void grantComplimentaryDays(t.id, d)}
                                className="text-[10px] font-semibold px-1.5 py-0.5 rounded border border-amber-600/40 bg-amber-950/30 text-amber-200 hover:bg-amber-900/40 disabled:opacity-40"
                                title={`Добавить ${d} дн. к сроку подписки`}
                              >
                                +{d}д
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="px-3 sm:px-4 py-3 text-right tabular-nums text-white align-top">
                      {t.mrrRub > 0 ? `₽ ${t.mrrRub.toLocaleString('ru-RU')}` : '—'}
                    </td>
                    <td className="px-3 sm:px-4 py-3 align-top">
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
                    <td className="px-3 sm:px-4 py-3 align-top">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => void impersonate(t)}
                          className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-violet-500/15 text-violet-300 border border-violet-500/30 hover:bg-violet-500/25"
                          title="Одноразовая ссылка входа в CRM"
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
          ) : null}
        </div>
      </div>

      <p className="text-xs text-zinc-600 max-w-3xl leading-relaxed">
        API: <span className="font-mono text-[11px] text-zinc-500">{apiBase}</span>. Вход клиента в CRM — только
        пароль панели или «Войти как».
      </p>
    </div>
  );
}
