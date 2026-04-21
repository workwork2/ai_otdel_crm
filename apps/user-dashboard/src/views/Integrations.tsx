'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Database,
  MessageSquare,
  Download,
  CheckCircle2,
  Share2,
  Phone,
  Mail,
  Loader2,
  Lock,
  Send,
  FlaskConical,
  Plug,
  Plus,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import { getApiBaseUrl, getTenantIdClient, jsonTenantHeaders, tenantFetchHeaders } from '@/lib/backend-api';
import { apiFetchJson } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useSubscription } from '@/context/SubscriptionContext';
import { pushToast } from '@/lib/toast';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { NativeSelect } from '@/components/ui/NativeSelect';

export type IntRow = {
  id: string;
  name: string;
  category: string;
  status: 'connected' | 'available' | 'error';
  config?: Record<string, unknown>;
};

function metaFor(row: IntRow): { desc: string; icon: React.ReactNode } {
  const n = row.name;
  if (n.includes('1С'))
    return {
      desc: 'Синхронизация чеков, товаров и клиентов.',
      icon: <div className="font-bold text-lg text-yellow-500">1C</div>,
    };
  if (n.includes('YCLIENTS'))
    return {
      desc: 'Запись на услуги и визиты.',
      icon: <div className="font-bold text-lg text-[#ec4899]">Y</div>,
    };
  if (n.includes('RetailCRM'))
    return {
      desc: 'Заказы из интернет-магазина.',
      icon: <div className="font-bold text-lg text-green-400">R</div>,
    };
  if (n.includes('iiko') || n.includes('r_keeper'))
    return {
      desc: 'Рестораны и доставка.',
      icon: <div className="font-bold text-lg text-orange-400">i</div>,
    };
  if (n.includes('WhatsApp'))
    return {
      desc: 'Официальный WhatsApp Business API.',
      icon: <MessageSquare className="w-7 h-7 text-green-500" />,
    };
  if (n.includes('Telegram'))
    return {
      desc: 'Бот и рассылки в Telegram.',
      icon: <MessageSquare className="w-7 h-7 text-blue-400" />,
    };
  if (n.includes('SMS'))
    return {
      desc: 'Текстовые SMS через провайдера.',
      icon: <Phone className="w-7 h-7 text-purple-400" />,
    };
  if (n.includes('Email'))
    return {
      desc: 'SMTP: рассылки и уведомления. Можно задать свои реквизиты в настройках.',
      icon: <Mail className="w-7 h-7 text-sky-400" />,
    };
  if (n.includes('MAX'))
    return {
      desc: 'Канал MAX для диалогов в экосистеме VK. Доступен на тарифе Pro и выше.',
      icon: (
        <div className="w-12 h-12 rounded-xl bg-[#0077FF]/15 border border-[#0077FF]/30 flex items-center justify-center font-bold text-[#0077FF] text-sm">
          M
        </div>
      ),
    };
  return {
    desc: 'Пользовательское подключение: URL, ключ API, заметки.',
    icon: <Share2 className="w-7 h-7 text-zinc-400" />,
  };
}

function IntegrationConfigModal({
  row,
  onClose,
  onSave,
}: {
  row: IntRow;
  onClose: () => void;
  onSave: (config: Record<string, unknown>) => void;
}) {
  const isEmail = row.name === 'Email';
  const c = (row.config ?? {}) as Record<string, unknown>;

  const [smtpHost, setSmtpHost] = useState(String(c.smtpHost ?? ''));
  const [smtpPort, setSmtpPort] = useState(String(c.smtpPort ?? '587'));
  const [smtpSecure, setSmtpSecure] = useState(
    c.smtpSecure === true || String(c.smtpSecure) === 'true'
  );
  const [smtpUser, setSmtpUser] = useState(String(c.smtpUser ?? ''));
  const [smtpPass, setSmtpPass] = useState(
    c.smtpPass === '********' ? '' : String(c.smtpPass ?? '')
  );
  const [smtpFrom, setSmtpFrom] = useState(String(c.smtpFrom ?? ''));

  const [apiBaseUrl, setApiBaseUrl] = useState(String(c.apiBaseUrl ?? c.endpoint ?? ''));
  const [apiKey, setApiKey] = useState(c.apiKey === '********' ? '' : String(c.apiKey ?? ''));
  const [notes, setNotes] = useState(String(c.notes ?? ''));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEmail) {
      if (!smtpHost.trim() || !smtpUser.trim()) {
        pushToast('Укажите хост SMTP и логин', 'error');
        return;
      }
      if (!smtpPass.trim() && c.smtpPass !== '********') {
        pushToast(
          'Укажите пароль SMTP. Для Mail.ru создайте «пароль приложения» в настройках почты — не пароль от ящика.',
          'error'
        );
        return;
      }
      const cfg: Record<string, unknown> = {
        smtpHost: smtpHost.trim(),
        smtpPort: Math.min(65535, Math.max(1, parseInt(smtpPort, 10) || 587)),
        smtpSecure,
        smtpUser: smtpUser.trim(),
      };
      cfg.smtpFrom = smtpFrom.trim();
      if (smtpPass.trim()) cfg.smtpPass = smtpPass.trim();
      onSave(cfg);
      return;
    }
    const cfg: Record<string, unknown> = {
      apiBaseUrl: apiBaseUrl.trim(),
      notes: notes.trim(),
    };
    if (apiKey.trim()) cfg.apiKey = apiKey.trim();
    onSave(cfg);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div
        className="w-full max-w-lg rounded-2xl border border-[#27272a] bg-[#121214] shadow-2xl max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-labelledby="int-config-title"
      >
        <div className="flex items-start justify-between gap-3 p-5 border-b border-[#1f1f22]">
          <div>
            <h2 id="int-config-title" className="text-lg font-semibold text-white">
              Настройка: {row.name}
            </h2>
            <p className="text-xs text-[#71717a] mt-1">
              Данные сохраняются в workspace организации на сервере.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-[#71717a] hover:text-white hover:bg-[#1f1f22]"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {isEmail ? (
            <>
              <p className="text-sm text-[#a1a1aa]">
                Если заполните поля ниже, рассылки пойдут через ваш SMTP. Иначе используется общий SMTP
                сервера API (если задан в <code className="text-xs bg-black/40 px-1 rounded">.env</code>).
              </p>
              <p className="text-xs text-[#71717a] leading-relaxed">
                <strong className="text-[#a1a1aa]">Mail.ru:</strong> хост <code className="text-[11px]">smtp.mail.ru</code>
                , чаще порт <strong>465</strong> (шифрование сразу). Порт 587 — STARTTLS; сервер API сам
                выставляет режим для 465/587. Нужен пароль приложения в настройках Mail.
              </p>
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-[10px] uppercase tracking-wider text-[#52525b] font-semibold w-full sm:w-auto">
                  Пресеты
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSmtpHost('smtp.mail.ru');
                    setSmtpPort('465');
                    setSmtpSecure(true);
                  }}
                  className="text-xs px-2.5 py-1.5 rounded-lg border border-[#27272a] text-[#d4d4d8] hover:bg-[#1f1f22]"
                >
                  Mail.ru 465
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSmtpHost('smtp.mail.ru');
                    setSmtpPort('587');
                    setSmtpSecure(false);
                  }}
                  className="text-xs px-2.5 py-1.5 rounded-lg border border-[#27272a] text-[#d4d4d8] hover:bg-[#1f1f22]"
                >
                  Mail.ru 587
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSmtpHost('smtp.yandex.ru');
                    setSmtpPort('465');
                    setSmtpSecure(true);
                  }}
                  className="text-xs px-2.5 py-1.5 rounded-lg border border-[#27272a] text-[#d4d4d8] hover:bg-[#1f1f22]"
                >
                  Yandex 465
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-[11px] uppercase tracking-wider text-[#71717a] font-semibold block mb-1">
                    Хост SMTP
                  </label>
                  <input
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    placeholder="smtp.mail.ru"
                    className="w-full rounded-lg border border-[#27272a] bg-[#0a0a0c] text-[#e4e4e7] text-sm px-3 py-2.5 outline-none focus:border-sky-500/40"
                  />
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-[#71717a] font-semibold block mb-1">
                    Порт
                  </label>
                  <input
                    value={smtpPort}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^\d]/g, '');
                      setSmtpPort(v);
                      const p = parseInt(v, 10);
                      if (p === 465) setSmtpSecure(true);
                      if (p === 587) setSmtpSecure(false);
                    }}
                    className="w-full rounded-lg border border-[#27272a] bg-[#0a0a0c] text-[#e4e4e7] text-sm px-3 py-2.5 outline-none focus:border-sky-500/40 tabular-nums"
                  />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 text-sm text-[#d4d4d8] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={smtpSecure}
                      onChange={(e) => setSmtpSecure(e.target.checked)}
                      className="rounded border-[#27272a]"
                    />
                    SSL с первого байта (для кастомных портов; 465/587 настраиваются автоматически)
                  </label>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[11px] uppercase tracking-wider text-[#71717a] font-semibold block mb-1">
                    Логин
                  </label>
                  <input
                    value={smtpUser}
                    onChange={(e) => setSmtpUser(e.target.value)}
                    autoComplete="off"
                    className="w-full rounded-lg border border-[#27272a] bg-[#0a0a0c] text-[#e4e4e7] text-sm px-3 py-2.5 outline-none focus:border-sky-500/40"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[11px] uppercase tracking-wider text-[#71717a] font-semibold block mb-1">
                    Пароль
                  </label>
                  <PasswordInput
                    value={smtpPass}
                    onChange={(e) => setSmtpPass(e.target.value)}
                    placeholder={c.smtpPass === '********' ? 'Оставьте пустым, чтобы не менять' : 'Пароль SMTP'}
                    autoComplete="new-password"
                    inputClassName="!bg-[#0a0a0c] !border-[#27272a] !text-[#e4e4e7] !pr-10"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[11px] uppercase tracking-wider text-[#71717a] font-semibold block mb-1">
                    От кого (From), необязательно
                  </label>
                  <input
                    value={smtpFrom}
                    onChange={(e) => setSmtpFrom(e.target.value)}
                    placeholder="Магазин <no-reply@company.ru>"
                    className="w-full rounded-lg border border-[#27272a] bg-[#0a0a0c] text-[#e4e4e7] text-sm px-3 py-2.5 outline-none focus:border-sky-500/40"
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-[#71717a] font-semibold block mb-1">
                  Базовый URL API
                </label>
                <input
                  value={apiBaseUrl}
                  onChange={(e) => setApiBaseUrl(e.target.value)}
                  placeholder="https://api.partner.ru/v1"
                  className="w-full rounded-lg border border-[#27272a] bg-[#0a0a0c] text-[#e4e4e7] text-sm px-3 py-2.5 outline-none focus:border-sky-500/40"
                />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-[#71717a] font-semibold block mb-1">
                  API-ключ / токен
                </label>
                <PasswordInput
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={c.apiKey === '********' ? 'Оставьте пустым, чтобы не менять' : ''}
                  autoComplete="new-password"
                  inputClassName="!bg-[#0a0a0c] !border-[#27272a] !text-[#e4e4e7] !pr-10"
                />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-[#71717a] font-semibold block mb-1">
                  Заметки
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Webhook, ID витрины, комментарий для команды…"
                  className="w-full rounded-lg border border-[#27272a] bg-[#0a0a0c] text-[#e4e4e7] text-sm px-3 py-2.5 outline-none focus:border-sky-500/40 resize-y"
                />
              </div>
            </>
          )}

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-[#27272a] text-sm text-[#d4d4d8] hover:bg-[#1f1f22]"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold"
            >
              Сохранить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function Integrations() {
  const apiBase = getApiBaseUrl();
  const [tenantId, setTenantId] = useState(() => getTenantIdClient());
  const [rows, setRows] = useState<IntRow[] | null>(null);
  const [loading, setLoading] = useState(!!apiBase);
  const [configuring, setConfiguring] = useState<IntRow | null>(null);
  const { has, subscription } = useSubscription();
  const canManage = !subscription || has('integrationsManage');
  const showMax = !subscription || has('maxChannel');

  useEffect(() => {
    const sync = () => setTenantId(getTenantIdClient());
    sync();
    window.addEventListener('focus', sync);
    window.addEventListener('storage', sync);
    window.addEventListener('linearize-tenant-auth', sync);
    return () => {
      window.removeEventListener('focus', sync);
      window.removeEventListener('storage', sync);
      window.removeEventListener('linearize-tenant-auth', sync);
    };
  }, []);

  useEffect(() => {
    if (!tenantId.trim()) {
      setRows(null);
      setLoading(false);
    }
  }, [tenantId]);

  /** Новая организация — без полей и черновиков от предыдущего входа. */
  useEffect(() => {
    setTestTo('');
    setMailBusy(null);
    setRetentionTarget('retention');
    setRetentionLimit(20);
    setConfiguring(null);
  }, [tenantId]);

  const load = useCallback(async () => {
    if (!apiBase) {
      setRows(null);
      setLoading(false);
      return;
    }
    const id = getTenantIdClient().trim();
    if (!id) {
      setRows(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = await apiFetchJson<IntRow[]>(`${apiBase}/v1/tenant/${id}/integrations`, {
      headers: tenantFetchHeaders(),
      retries: 2,
      silent: true,
    });
    if (getTenantIdClient().trim() !== id) {
      setLoading(false);
      return;
    }
    if (res.ok && Array.isArray(res.data)) setRows(res.data);
    else {
      setRows([]);
      if (!res.ok) pushToast(res.error, 'error');
    }
    setLoading(false);
  }, [apiBase, tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const persist = useCallback(
    async (next: IntRow[]) => {
      if (!apiBase) return;
      const id = getTenantIdClient().trim();
      if (!id) {
        pushToast('Нет организации — войдите снова', 'error');
        return;
      }
      if (!canManage) {
        pushToast('Управление интеграциями недоступно на текущем тарифе', 'error');
        return;
      }
      const res = await apiFetchJson<IntRow[]>(`${apiBase}/v1/tenant/${id}/integrations`, {
        method: 'PUT',
        headers: jsonTenantHeaders(),
        body: JSON.stringify({ integrations: next }),
        retries: 1,
      });
      if (getTenantIdClient().trim() !== id) return;
      if (res.ok) {
        setRows(res.data);
        pushToast('Сохранено', 'success');
      } else pushToast(res.error, 'error');
    },
    [apiBase, canManage]
  );

  const onConnect = (row: IntRow) => {
    if (!apiBase) {
      pushToast('Включите API (NEXT_PUBLIC_API_URL)', 'error');
      return;
    }
    if (!canManage) {
      pushToast('Нужен тариф с управлением интеграциями', 'error');
      return;
    }
    if (row.name.includes('MAX') && !showMax) {
      pushToast('Канал MAX (VK) доступен на тарифе Pro и выше', 'error');
      return;
    }
    const next = (rows ?? []).map((r) =>
      r.id === row.id ? { ...r, status: 'connected' as const } : r
    );
    void persist(next);
  };

  const onConfigure = (row: IntRow) => {
    if (!canManage) {
      pushToast('Настройка недоступна на текущем тарифе', 'error');
      return;
    }
    setConfiguring(row);
  };

  const saveConfig = (config: Record<string, unknown>) => {
    if (!configuring || !rows) return;
    const next = rows.map((r) =>
      r.id === configuring.id ? { ...r, config: { ...(r.config ?? {}), ...config } } : r
    );
    setConfiguring(null);
    void persist(next);
  };

  const addCustomIntegration = () => {
    if (!canManage || !rows) return;
    const label = window.prompt('Название подключения (например, «Своя CRM»)');
    if (!label?.trim()) return;
    const category = window.confirm('ОК — канал связи (мессенджеры). Отмена — CRM / учёт.') ? 'channel' : 'crm';
    const id = `custom-${crypto.randomUUID().slice(0, 10)}`;
    void persist([...rows, { id, name: label.trim(), category, status: 'available' }]);
  };

  const onDisconnect = (row: IntRow) => {
    if (!canManage) return;
    const next = (rows ?? []).map((r) =>
      r.id === row.id ? { ...r, status: 'available' as const } : r
    );
    void persist(next);
  };

  const crm = useMemo(() => (rows ?? []).filter((r) => r.category === 'crm'), [rows]);
  const channels = useMemo(() => (rows ?? []).filter((r) => r.category === 'channel'), [rows]);
  const emailConnected = useMemo(
    () => !!(rows ?? []).find((r) => r.name === 'Email' && r.status === 'connected'),
    [rows]
  );

  const [emailStatus, setEmailStatus] = useState<{
    configured: boolean;
    from: string | null;
    source?: string;
  } | null>(null);
  const [testTo, setTestTo] = useState('');
  const [mailBusy, setMailBusy] = useState<'test' | 'verify' | 'dry' | 'send' | null>(null);
  const [retentionTarget, setRetentionTarget] = useState<'retention' | 'marketing'>('retention');
  const [retentionLimit, setRetentionLimit] = useState(20);

  const loadEmailStatus = useCallback(async () => {
    if (!apiBase) {
      setEmailStatus(null);
      return;
    }
    const id = getTenantIdClient().trim();
    if (!id) {
      setEmailStatus(null);
      return;
    }
    const res = await apiFetchJson<{ configured: boolean; from: string | null; source?: string }>(
      `${apiBase}/v1/tenant/${id}/email/status`,
      { headers: tenantFetchHeaders(), silent: true, retries: 1 }
    );
    if (getTenantIdClient().trim() !== id) return;
    if (res.ok) setEmailStatus(res.data);
    else setEmailStatus(null);
  }, [apiBase, tenantId]);

  useEffect(() => {
    void loadEmailStatus();
  }, [loadEmailStatus, rows]);

  const sendTestEmail = useCallback(async () => {
    if (!apiBase || !canManage) return;
    const id = getTenantIdClient().trim();
    if (!id) {
      pushToast('Нет организации — войдите снова', 'error');
      return;
    }
    const to = testTo.trim();
    if (!to) {
      pushToast('Укажите email для теста', 'error');
      return;
    }
    setMailBusy('test');
    const res = await apiFetchJson<{ ok: boolean }>(
      `${apiBase}/v1/tenant/${id}/email/test`,
      {
        method: 'POST',
        headers: jsonTenantHeaders(),
        body: JSON.stringify({ to }),
        retries: 0,
        silent: true,
      }
    );
    setMailBusy(null);
    if (getTenantIdClient().trim() !== id) return;
    if (res.ok) {
      pushToast('Тестовое письмо отправлено', 'success');
    } else {
      pushToast(res.error || 'Не удалось отправить тест', 'error');
    }
  }, [apiBase, testTo, canManage]);

  const verifySmtpConnection = useCallback(async () => {
    if (!apiBase || !canManage) return;
    const id = getTenantIdClient().trim();
    if (!id) {
      pushToast('Нет организации — войдите снова', 'error');
      return;
    }
    setMailBusy('verify');
    const res = await apiFetchJson<{ ok: boolean }>(`${apiBase}/v1/tenant/${id}/email/verify`, {
      method: 'POST',
      headers: jsonTenantHeaders(),
      body: JSON.stringify({}),
      retries: 0,
      silent: true,
    });
    setMailBusy(null);
    if (getTenantIdClient().trim() !== id) return;
    if (res.ok) {
      pushToast('SMTP: соединение и логин успешны (письмо не отправлялось)', 'success');
    } else {
      pushToast(res.error || 'Проверка SMTP не удалась', 'error');
    }
  }, [apiBase, canManage]);

  const dryRunRetention = useCallback(async () => {
    if (!apiBase || !canManage) return;
    const id = getTenantIdClient().trim();
    if (!id) {
      pushToast('Нет организации — войдите снова', 'error');
      return;
    }
    setMailBusy('dry');
    const res = await apiFetchJson<{
      dryRun?: boolean;
      count?: number;
      sampleEmails?: string[];
    }>(`${apiBase}/v1/tenant/${id}/email/retention-campaign`, {
      method: 'POST',
      headers: jsonTenantHeaders(),
      body: JSON.stringify({
        target: retentionTarget,
        limit: retentionLimit,
        dryRun: true,
      }),
      retries: 0,
    });
    setMailBusy(null);
    if (getTenantIdClient().trim() !== id) return;
    if (res.ok && res.data.dryRun) {
      pushToast(
        `Сухой прогон: ${res.data.count ?? 0} получателей. Примеры: ${(res.data.sampleEmails ?? []).slice(0, 3).join(', ')}`,
        'success'
      );
    }
  }, [apiBase, canManage, retentionTarget, retentionLimit]);

  const sendRetention = useCallback(async () => {
    if (!apiBase || !canManage) return;
    const id = getTenantIdClient().trim();
    if (!id) {
      pushToast('Нет организации — войдите снова', 'error');
      return;
    }
    if (
      !confirm(
        `Отправить рассылку удержания (${retentionTarget === 'retention' ? 'когорта риска' : 'все с согласием'}) до ${retentionLimit} писем?`
      )
    ) {
      return;
    }
    setMailBusy('send');
    const res = await apiFetchJson<{
      sent?: number;
      attempted?: number;
      failed?: number;
      errors?: string[];
    }>(`${apiBase}/v1/tenant/${id}/email/retention-campaign`, {
      method: 'POST',
      headers: jsonTenantHeaders(),
      body: JSON.stringify({
        target: retentionTarget,
        limit: retentionLimit,
        dryRun: false,
      }),
      retries: 0,
    });
    setMailBusy(null);
    if (getTenantIdClient().trim() !== id) return;
    if (res.ok) {
      pushToast(
        `Отправлено: ${res.data.sent ?? 0} из ${res.data.attempted ?? 0}`,
        res.data.failed ? 'error' : 'success'
      );
      if (res.data.errors?.length) {
        pushToast(res.data.errors[0] ?? 'Часть писем не ушла', 'error');
      }
    }
  }, [apiBase, canManage, retentionTarget, retentionLimit]);

  return (
    <div className="crm-page crm-page--std custom-scrollbar space-y-6 sm:space-y-10 fade-in">
      {configuring ? (
        <IntegrationConfigModal
          row={configuring}
          onClose={() => setConfiguring(null)}
          onSave={saveConfig}
        />
      ) : null}

      <div className="max-w-3xl min-w-0">
        <h1 className="crm-page-h1">Подключение сервисов</h1>
        <p className="crm-page-lead">
          Каталог интеграций хранится на сервере. Для каждой можно открыть{' '}
          <strong className="text-zinc-300 font-medium">настройки</strong>: почта — SMTP и пароль, остальные —
          URL и API-ключ. Импорт клиентов из Excel — в разделе{' '}
          <Link href="/clients" className="text-sky-400 hover:text-sky-300 underline underline-offset-2">
            Клиенты
          </Link>
          .
        </p>
        {!canManage && subscription ? (
          <p className="mt-3 text-sm text-amber-200/90 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2">
            На пробном тарифе интеграции только для просмотра.{' '}
            <Link href="/billing" className="text-amber-300 underline underline-offset-2">
              Повысить тариф
            </Link>
          </p>
        ) : null}
        {loading ? (
          <p className="text-xs text-[#71717a] mt-2 flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Загрузка…
          </p>
        ) : null}
      </div>

      <section className="crm-card p-5 border border-[#27272a] bg-[#121214]/50 max-w-3xl">
        <div className="flex items-start gap-3">
          <FileSpreadsheet className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-white">Импорт Excel</h3>
            <p className="text-xs text-[#a1a1aa] mt-1 leading-relaxed">
              Загрузка .xlsx / .xls с автовыбором листа с наибольшим числом строк и распознаванием колонок
              (имя, телефон, email и др.). Результат объединяется с базой на сервере.
            </p>
            <Link
              href="/clients"
              className="inline-flex mt-3 text-xs font-semibold text-emerald-400 hover:text-emerald-300"
            >
              Открыть «Клиенты» →
            </Link>
          </div>
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#10b981]/10 flex items-center justify-center shrink-0">
              <Database className="w-5 h-5 text-[#10b981]" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-white">Учётные системы и CRM</h2>
              <p className="text-sm text-[#71717a]">Покупки, чеки, клиенты</p>
            </div>
          </div>
          {canManage && rows ? (
            <button
              type="button"
              onClick={addCustomIntegration}
              className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg border border-[#27272a] text-[#d4d4d8] hover:bg-[#1f1f22]"
            >
              <Plus className="w-3.5 h-3.5" />
              Своя интеграция
            </button>
          ) : null}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
          {crm.map((row) => (
            <IntegrationCard
              key={row.id}
              row={row}
              canManage={canManage}
              maxLocked={false}
              onConnect={() => onConnect(row)}
              onConfigure={() => onConfigure(row)}
              onDisconnect={() => onDisconnect(row)}
            />
          ))}
        </div>
      </section>

      <section className="pt-6 border-t border-[#1f1f22]">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-[#3b82f6]/10 flex items-center justify-center shrink-0">
            <Share2 className="w-5 h-5 text-[#3b82f6]" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-white">Мессенджеры и SMS</h2>
            <p className="text-sm text-[#71717a]">Каналы исходящих касаний</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {channels
            .filter((row) => !(row.name.includes('MAX') && !showMax))
            .map((row) => (
              <IntegrationCard
                key={row.id}
                row={row}
                canManage={canManage}
                maxLocked={row.name.includes('MAX') && !showMax}
                onConnect={() => onConnect(row)}
                onConfigure={() => onConfigure(row)}
                onDisconnect={() => onDisconnect(row)}
              />
            ))}
          {!showMax && (
            <div className="crm-card p-5 border border-[#0077FF]/20 bg-[#0077FF]/5 flex flex-col justify-center min-h-[180px]">
              <div className="flex items-center gap-2 text-[#0077FF] text-sm font-semibold mb-2">
                <Lock className="w-4 h-4" />
                MAX (VK)
              </div>
              <p className="text-xs text-[#a1a1aa] leading-relaxed mb-4">
                Канал MAX доступен на тарифе Pro и выше.
              </p>
              <Link
                href="/billing"
                className="inline-flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium bg-[#0077FF]/15 text-[#60a5fa] border border-[#0077FF]/30 hover:bg-[#0077FF]/25"
              >
                Выбрать тариф
              </Link>
            </div>
          )}
        </div>
      </section>

      {apiBase && emailConnected ? (
        <section className="pt-6 border-t border-[#1f1f22]">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-sky-500/15 flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-white">Почта: SMTP и удержание</h2>
              <p className="text-sm text-[#71717a]">
                Приоритет: SMTP из настроек интеграции «Email», иначе переменные окружения API.
              </p>
            </div>
          </div>

          <div className="crm-card p-6 border border-sky-500/20 bg-sky-950/10 space-y-5 max-w-3xl">
            {emailStatus?.source === 'global' ? (
              <p className="text-xs text-[#a1a1aa] leading-relaxed rounded-lg border border-[#27272a] bg-[#0a0a0c] px-3 py-2">
                Сейчас используется <strong className="text-[#d4d4d8]">общий SMTP платформы</strong> из{' '}
                <code className="text-[11px]">apps/api/.env</code> — адрес отправителя одинаков для всех
                организаций, у которых не задан свой SMTP в карточке «Email». Это не «перетекание» данных
                между аккаунтами: у новой организации своя база, но общий серверный ящик, пока вы не
                подключите свой.
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="text-[#a1a1aa]">Отправка:</span>
              {emailStatus?.configured ? (
                <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
                  <CheckCircle2 className="w-4 h-4" /> готова
                  {emailStatus.from ? (
                    <span className="text-[#71717a] font-normal">· {emailStatus.from}</span>
                  ) : null}
                  {emailStatus.source === 'tenant' ? (
                    <span className="text-[11px] text-sky-300/90 font-normal">(ваш SMTP)</span>
                  ) : emailStatus.source === 'global' ? (
                    <span className="text-[11px] text-amber-200/80 font-normal">(общий SMTP API)</span>
                  ) : null}
                </span>
              ) : (
                <span className="text-amber-200/90">
                  задайте SMTP в настройках «Email» или SMTP_* в{' '}
                  <code className="text-xs bg-black/30 px-1 rounded">apps/api/.env</code>
                </span>
              )}
              <button
                type="button"
                onClick={() => void loadEmailStatus()}
                className="text-xs text-sky-400 hover:text-sky-300 underline underline-offset-2"
              >
                Обновить статус
              </button>
            </div>

            {!canManage ? (
              <p className="text-sm text-amber-200/90">
                Нужен тариф с управлением интеграциями, чтобы отправлять письма.{' '}
                <Link href="/billing" className="underline underline-offset-2 text-amber-300">
                  Тарифы
                </Link>
              </p>
            ) : (
              <>
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                    <div className="flex-1 min-w-0">
                      <label className="text-[11px] uppercase tracking-wider text-[#71717a] font-semibold block mb-1.5">
                        Тестовая отправка
                      </label>
                      <input
                        type="email"
                        value={testTo}
                        onChange={(e) => setTestTo(e.target.value)}
                        placeholder="you@company.ru"
                        className="w-full rounded-lg border border-[#27272a] bg-[#0a0a0c] text-[#e4e4e7] text-sm px-3 py-2.5 outline-none focus:border-sky-500/40"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={!!mailBusy || !emailStatus?.configured}
                        onClick={() => void verifySmtpConnection()}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-sky-500/40 bg-sky-950/40 hover:bg-sky-900/50 disabled:opacity-40 text-sky-200 text-sm font-semibold px-4 py-2.5"
                      >
                        {mailBusy === 'verify' ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Plug className="w-4 h-4" />
                        )}
                        Проверить логин
                      </button>
                      <button
                        type="button"
                        disabled={!!mailBusy || !emailStatus?.configured}
                        onClick={() => void sendTestEmail()}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white text-sm font-semibold px-4 py-2.5"
                      >
                        {mailBusy === 'test' ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <FlaskConical className="w-4 h-4" />
                        )}
                        Отправить тест
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] text-[#71717a]">
                    «Проверить логин» — только соединение с SMTP и авторизация. «Отправить тест» — реальное
                    письмо на указанный адрес.
                  </p>
                </div>

                <div className="border-t border-[#1f1f22] pt-5 space-y-3">
                  <div className="text-[11px] uppercase tracking-wider text-[#71717a] font-semibold flex items-center gap-2">
                    <Send className="w-3.5 h-3.5" />
                    Рассылка удержания (как сценарий «Реактивация»)
                  </div>
                  <div className="flex flex-wrap gap-3 items-stretch sm:items-center min-w-0">
                    <NativeSelect
                      variant="field"
                      className="w-full sm:w-auto sm:min-w-[min(100%,280px)]"
                      selectClassName="border-[#27272a]"
                      value={retentionTarget}
                      onChange={(e) => setRetentionTarget(e.target.value as 'retention' | 'marketing')}
                      aria-label="Целевая аудитория рассылки"
                    >
                      <option value="retention">Когорта удержания (риск / dormant)</option>
                      <option value="marketing">Все с маркетинговым согласием</option>
                    </NativeSelect>
                    <label className="flex items-center gap-2 text-sm text-[#a1a1aa]">
                      Лимит
                      <input
                        type="number"
                        min={1}
                        max={500}
                        value={retentionLimit}
                        onChange={(e) => setRetentionLimit(Number(e.target.value) || 20)}
                        className="w-20 rounded-lg border border-[#27272a] bg-[#0a0a0c] text-white text-sm px-2 py-1.5 tabular-nums"
                      />
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={!!mailBusy}
                      onClick={() => void dryRunRetention()}
                      className="inline-flex items-center gap-2 rounded-lg border border-[#27272a] text-[#d4d4d8] text-sm px-3 py-2 hover:bg-[#1f1f22] disabled:opacity-40"
                    >
                      {mailBusy === 'dry' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      Сухой прогон
                    </button>
                    <button
                      type="button"
                      disabled={!!mailBusy || !emailStatus?.configured}
                      onClick={() => void sendRetention()}
                      className="inline-flex items-center gap-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-semibold px-4 py-2"
                    >
                      {mailBusy === 'send' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      Отправить кампанию
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function IntegrationCard({
  row,
  canManage,
  maxLocked,
  onConnect,
  onConfigure,
  onDisconnect,
}: {
  row: IntRow;
  canManage: boolean;
  maxLocked: boolean;
  onConnect: () => void;
  onConfigure: () => void;
  onDisconnect: () => void;
}) {
  const { desc, icon } = metaFor(row);
  const isConnected = row.status === 'connected';
  const locked = maxLocked || !canManage;
  const hasConfig = row.config && Object.keys(row.config).length > 0;

  return (
    <div className="crm-card p-5 group hover:border-[#3f3f46] transition-colors h-full flex flex-col">
      <div className="flex justify-between items-start mb-4 gap-2">
        <div className="w-12 h-12 rounded-xl bg-[#121214] border border-[#1f1f22] flex items-center justify-center shrink-0">
          {icon}
        </div>
        {maxLocked ? (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#71717a] bg-[#1f1f22] px-2.5 py-1 rounded-md shrink-0">
            <Lock className="w-3.5 h-3.5" />
            Тариф
          </div>
        ) : isConnected ? (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#10b981] bg-[#10b981]/10 px-2.5 py-1 rounded-md shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Подключено
          </div>
        ) : row.status === 'error' ? (
          <div className="text-xs font-semibold text-red-400 bg-red-500/10 px-2.5 py-1 rounded-md shrink-0">
            Ошибка
          </div>
        ) : (
          <div className="text-xs font-semibold text-[#71717a] bg-[#1f1f22] px-2.5 py-1 rounded-md shrink-0">
            Доступно
          </div>
        )}
      </div>

      <h3 className="text-[15px] font-semibold text-white mb-1.5">{row.name}</h3>
      <p className="text-[13px] text-[#a1a1aa] leading-relaxed mb-2 flex-1">{desc}</p>
      {hasConfig ? (
        <p className="text-[10px] text-sky-500/90 mb-4">Параметры сохранены — откройте «Настроить», чтобы изменить.</p>
      ) : (
        <div className="mb-4" />
      )}

      {isConnected ? (
        <div className="flex gap-2 mt-auto">
          <button
            type="button"
            onClick={onConfigure}
            disabled={locked}
            className={cn(
              'flex-1 py-2.5 rounded-lg text-sm font-medium border border-[#27272a] text-[#d4d4d8] hover:bg-[#1f1f22] transition-colors',
              locked && 'opacity-40 pointer-events-none'
            )}
          >
            Настроить
          </button>
          <button
            type="button"
            onClick={onDisconnect}
            disabled={locked}
            className="py-2.5 px-3 rounded-lg text-xs border border-zinc-600 text-zinc-400 hover:bg-zinc-800 disabled:opacity-40"
          >
            Откл.
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 mt-auto w-full">
          <button
            type="button"
            onClick={onConnect}
            disabled={locked || maxLocked}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium bg-[#3b82f6]/10 text-[#3b82f6] hover:bg-[#3b82f6]/20 transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            <Download className="w-4 h-4" />
            Подключить
          </button>
          {!maxLocked ? (
            <button
              type="button"
              onClick={onConfigure}
              disabled={locked}
              className="w-full py-2 rounded-lg text-xs font-medium border border-[#27272a] text-[#a1a1aa] hover:bg-[#1f1f22] disabled:opacity-40"
            >
              Сначала настроить (SMTP, ключи…)
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
