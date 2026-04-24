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
import { PasswordInput } from '@/components/platform/PasswordInput';
import { NativeSelect } from '@/components/platform/NativeSelect';
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

function statusCellClass(status: TenantStatus): string {
  const map: Record<TenantStatus, string> = {
    trial: 'st-tenants-status st-tenants-status--trial',
    active: 'st-tenants-status st-tenants-status--active',
    past_due: 'st-tenants-status st-tenants-status--past_due',
    frozen: 'st-tenants-status st-tenants-status--frozen',
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
        setPortalPwdDraft((s) => ({ ...s, [id]: password }));
        setPortalOk((s) => ({ ...s, [id]: 'Пароль сохранён.' }));
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
        <div className="st-create-org">
          <div className="st-create-org__row">
            <label className="st-create-org__field">
              <span className="st-create-org__label">Название</span>
              <input
                value={cName}
                onChange={(e) => {
                  setCName(e.target.value);
                  setOrgErr(null);
                }}
                autoComplete="organization"
                className="st-create-org__input"
                placeholder="Название компании"
              />
            </label>
            <label className="st-create-org__field">
              <span className="st-create-org__label">Slug</span>
              <input
                value={cSlug}
                onChange={(e) => {
                  setCSlug(e.target.value);
                  setOrgErr(null);
                }}
                autoComplete="off"
                spellCheck={false}
                className="st-create-org__input st-create-org__input--mono"
                placeholder="my-shop (латиница)"
              />
            </label>
            <label className="st-create-org__field st-create-org__field--tariff">
              <span className="st-create-org__label">Тариф</span>
              <NativeSelect
                size="sm"
                className="st-create-org__select-wrap"
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
            </label>
            <div className="st-create-org__field st-create-org__field--submit">
              <span className="st-create-org__label st-create-org__label--ghost" aria-hidden>
                {'\u00a0'}
              </span>
              <button
                type="button"
                disabled={creating || !createNameOk || !createSlugOk}
                onClick={() => void createOrganization()}
                title={
                  !createNameOk || !createSlugOk
                    ? 'Заполните название и корректный slug (латиница, до 128 символов после нормализации)'
                    : undefined
                }
                className="st-create-org__submit"
              >
                {creating ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : null}
                Создать
              </button>
            </div>
          </div>
          <div className="st-create-org__hint">
            <p>
              {cSlug.trim() ? (
                <>
                  В базе:{' '}
                  <span className={createSlugOk ? 'text-zinc-400' : 'text-red-400'}>
                    {normalizedCreateSlug || '—'}
                  </span>
                  {!createSlugOk && normalizedCreateSlug.length > 128 ? ' (слишком длинно)' : null}
                  {!createSlugOk && !normalizedCreateSlug
                    ? ' (пусто после нормализации — используйте латиницу)'
                    : null}
                </>
              ) : (
                <span className="text-zinc-600">
                  После ввода slug здесь будет нормализованное значение для БД (латиница, дефисы).
                </span>
              )}
            </p>
          </div>
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
            <table className="st-tenants-table">
              <colgroup>
                <col style={{ width: '11%' }} />
                <col style={{ width: '19%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '12%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Организация</th>
                  <th>Пароль CRM</th>
                  <th>Статус</th>
                  <th>Регистрация</th>
                  <th>Тариф</th>
                  <th>Подписка</th>
                  <th className="st-tenants-table__num">MRR</th>
                  <th>Чат ТП</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <div className="st-tenants-table__org-name" title={t.name}>
                        {t.name}
                      </div>
                      <div className="st-tenants-table__org-slug" title={t.slug}>
                        {t.slug}
                      </div>
                      <div className="st-tenants-table__org-id">{t.id}</div>
                    </td>
                    <td>
                      <div className="st-tenants-pwd">
                        <span
                          className={cn(
                            'st-tenants-pwd__badge',
                            t.portalAccessConfigured ? 'st-tenants-pwd__badge--ok' : 'st-tenants-pwd__badge--no'
                          )}
                        >
                          <KeyRound className="h-3 w-3 shrink-0" />
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
                            setPortalOk((s) => {
                              const n = { ...s };
                              delete n[t.id];
                              return n;
                            });
                          }}
                          className="w-full min-w-0"
                          inputClassName="st-tenants-pwd__input"
                        />
                        <p
                          className="st-tenants-pwd__hint"
                          title="Введите пароль и нажмите «Сохранить» — он останется в поле. В базе хранится только хеш."
                        >
                          После сохранения пароль остаётся в поле; в БД — только хеш.
                        </p>
                        <div className="st-tenants-pwd__grid3">
                          <button
                            type="button"
                            onClick={() => {
                              const pwd = randomPortalPassword();
                              setPortalPwdDraft((s) => ({ ...s, [t.id]: pwd }));
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
                            title="Сгенерировать пароль"
                            className="st-tenants-pwd__btn min-w-0"
                          >
                            <Wand2 className="h-3 w-3 shrink-0" />
                            <span className="truncate text-center text-[10px]">Сгенерить</span>
                          </button>
                          <button
                            type="button"
                            disabled={!(portalPwdDraft[t.id] ?? '').trim()}
                            onClick={() => void copyText(t.id, (portalPwdDraft[t.id] ?? '').trim())}
                            title="Копировать пароль из поля"
                            className="st-tenants-pwd__btn min-w-0"
                          >
                            <Copy className="h-3 w-3 shrink-0" />
                            <span className="inline-block min-w-[4.25rem] text-center text-[10px]">
                              {copyFlash === t.id ? 'Готово' : 'Копия'}
                            </span>
                          </button>
                          <button
                            type="button"
                            disabled={savingPortalId === t.id}
                            onClick={() => void savePortalPassword(t.id)}
                            title="Сохранить пароль в базу"
                            className="st-tenants-pwd__btn st-tenants-pwd__btn--save min-w-0"
                          >
                            <span className="inline-block min-w-[4.75rem] text-center text-[10px]">
                              {savingPortalId === t.id ? '…' : 'Сохранить'}
                            </span>
                          </button>
                        </div>
                        {portalErr[t.id] ? (
                          <p className="st-tenants-pwd__msg text-red-400">{portalErr[t.id]}</p>
                        ) : null}
                        {portalOk[t.id] ? (
                          <p className="st-tenants-pwd__msg text-emerald-400/90">{portalOk[t.id]}</p>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <span className={statusCellClass(t.status)}>{STATUS_LABEL[t.status]}</span>
                    </td>
                    <td className="st-tenants-table__sub">{new Date(t.registeredAt).toLocaleDateString('ru-RU')}</td>
                    <td>
                      {apiBase ? (
                        <NativeSelect
                          size="sm"
                          className="st-tenants-table__select max-w-[11rem]"
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
                        <span className="text-zinc-300">{t.plan}</span>
                      )}
                    </td>
                    <td>
                      {apiBase && t.validUntil ? (
                        <div className="st-tenants-sub">
                          <div className="st-tenants-sub__line">
                            <CalendarClock className="h-3.5 w-3.5 shrink-0 text-amber-500/80" />
                            <span className="tabular-nums">
                              {new Date(t.validUntil).toLocaleDateString('ru-RU')}
                            </span>
                            {t.subscriptionExpired ? (
                              <span className="font-semibold text-red-400">истекла</span>
                            ) : typeof t.subscriptionDaysRemaining === 'number' ? (
                              <span className="text-zinc-500">· {t.subscriptionDaysRemaining} дн.</span>
                            ) : null}
                          </div>
                          <div className="st-tenants-sub__grid">
                            {([3, 7, 30] as const).map((d) => (
                              <button
                                key={d}
                                type="button"
                                disabled={extendingId === t.id}
                                onClick={() => void grantComplimentaryDays(t.id, d)}
                                className="st-tenants-btn st-tenants-btn--sm st-tenants-btn--amber-outline"
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
                    <td className="st-tenants-table__num text-white">
                      {t.mrrRub > 0 ? `₽ ${t.mrrRub.toLocaleString('ru-RU')}` : '—'}
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => toggleChat(t.id, !t.chatBlocked)}
                        className={cn(
                          'st-tenants-btn st-tenants-btn--chat',
                          t.chatBlocked ? 'st-tenants-btn--chat-off' : 'st-tenants-btn--chat-on'
                        )}
                        title={
                          t.chatBlocked
                            ? 'Разблокировать чат поддержки у клиента'
                            : 'Заблокировать чат (например, злоупотребления)'
                        }
                      >
                        {t.chatBlocked ? (
                          <>
                            <MessageCircleOff className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">Заблокир.</span>
                          </>
                        ) : (
                          <>
                            <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">Открыт</span>
                          </>
                        )}
                      </button>
                    </td>
                    <td>
                      <div className="st-tenants-actions">
                        <button
                          type="button"
                          onClick={() => void impersonate(t)}
                          className="st-tenants-btn st-tenants-btn--violet"
                          title="Одноразовая ссылка входа в CRM"
                        >
                          <Eye className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">Войти как</span>
                        </button>
                        {t.status === 'frozen' ? (
                          <button
                            type="button"
                            onClick={() => setStatus(t.id, 'active')}
                            className="st-tenants-btn st-tenants-btn--emerald"
                          >
                            <Sun className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">Разморозить</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setStatus(t.id, 'frozen')}
                            className="st-tenants-btn st-tenants-btn--zinc"
                          >
                            <Snowflake className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">Заморозить</span>
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
