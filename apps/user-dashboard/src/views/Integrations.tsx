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
} from 'lucide-react';
import { getApiBaseUrl, getTenantIdClient, jsonTenantHeaders, tenantFetchHeaders } from '@/lib/backend-api';
import { apiFetchJson } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useSubscription } from '@/context/SubscriptionContext';
import { pushToast } from '@/lib/toast';

type IntRow = {
  id: string;
  name: string;
  category: string;
  status: 'connected' | 'available' | 'error';
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
      desc: 'SMTP / API: триггерные письма, счета, напоминания.',
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
    desc: 'Интеграция с внешним сервисом.',
    icon: <Share2 className="w-7 h-7 text-zinc-400" />,
  };
}

export function Integrations() {
  const apiBase = getApiBaseUrl();
  const [tenantId, setTenantId] = useState(() => getTenantIdClient());
  const [rows, setRows] = useState<IntRow[] | null>(null);
  const [loading, setLoading] = useState(!!apiBase);
  const { has, subscription } = useSubscription();
  const canManage = !subscription || has('integrationsManage');
  const showMax = !subscription || has('maxChannel');

  useEffect(() => {
    const sync = () => setTenantId(getTenantIdClient());
    sync();
    window.addEventListener('focus', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('focus', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const load = useCallback(async () => {
    if (!apiBase) {
      setRows(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = await apiFetchJson<IntRow[]>(`${apiBase}/v1/tenant/${tenantId}/integrations`, {
      headers: tenantFetchHeaders(),
      retries: 2,
      silent: true,
    });
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
      if (!canManage) {
        pushToast('Управление интеграциями недоступно на текущем тарифе', 'error');
        return;
      }
      const res = await apiFetchJson<IntRow[]>(`${apiBase}/v1/tenant/${tenantId}/integrations`, {
        method: 'PUT',
        headers: jsonTenantHeaders(),
        body: JSON.stringify({ integrations: next }),
        retries: 1,
      });
      if (res.ok) {
        setRows(res.data);
        pushToast('Интеграции сохранены', 'success');
      }
    },
    [apiBase, tenantId, canManage]
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
    pushToast(`Демо: настройки «${row.name}» — в проде откроется мастер подключения`, 'success');
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

  return (
    <div className="flex-1 overflow-y-auto w-full max-w-6xl mx-auto px-4 sm:px-8 lg:px-10 py-8 sm:py-10 space-y-8 sm:space-y-10 fade-in">
      <div className="max-w-3xl">
        <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight">
          Подключение сервисов
        </h1>
        <p className="text-[#a1a1aa] mt-2 text-[15px] leading-relaxed">
          Свяжите AI Отдел с кассой, CRM, почтой и мессенджерами — в том числе с{' '}
          <strong className="text-zinc-300 font-medium">MAX</strong> (экосистема VK). Состояние
          сохраняется на сервере; недоступные каналы скрыты или помечены по тарифу.
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

      <section>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-[#10b981]/10 flex items-center justify-center shrink-0">
            <Database className="w-5 h-5 text-[#10b981]" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-white">Учётные системы и CRM</h2>
            <p className="text-sm text-[#71717a]">Покупки, чеки, клиенты</p>
          </div>
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
      <p className="text-[13px] text-[#a1a1aa] leading-relaxed mb-6 flex-1">{desc}</p>

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
        <button
          type="button"
          onClick={onConnect}
          disabled={locked || maxLocked}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium bg-[#3b82f6]/10 text-[#3b82f6] hover:bg-[#3b82f6]/20 transition-colors mt-auto disabled:opacity-40 disabled:pointer-events-none"
        >
          <Download className="w-4 h-4" />
          Подключить
        </button>
      )}
    </div>
  );
}
