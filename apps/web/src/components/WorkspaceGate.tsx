'use client';

import React from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useSubscription } from '@/context/SubscriptionContext';
import { getApiBaseUrl } from '@/lib/backend-api';
import { PLATFORM_BASE } from '@/lib/platform-routes';

const superApp =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_SUPER_APP_URL?.replace(/\/$/, '')) || PLATFORM_BASE;

/**
 * При включённом API без валидной подписки/тенанта не показываем «пустую» CRM —
 * понятный экран вместо частично работающих страниц и ложных редиректов.
 */
export function WorkspaceGate({ children }: { children: React.ReactNode }) {
  const api = getApiBaseUrl();
  const { loading, error, subscription, refresh } = useSubscription();

  if (!api) {
    return (
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="max-w-lg rounded-2xl border border-zinc-700 bg-zinc-950/80 px-6 py-8 space-y-3">
          <h2 className="text-lg font-semibold text-white">Нет адреса API</h2>
          <p className="text-sm text-zinc-400">
            Задайте <code className="text-xs text-zinc-300">NEXT_PUBLIC_API_URL</code> в окружении и перезапустите
            панель.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <>{children}</>;
  }

  if (error && !subscription) {
    return (
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="max-w-lg rounded-2xl border border-amber-500/35 bg-amber-950/25 px-6 py-8 space-y-4">
          <div className="flex justify-center">
            <AlertTriangle className="w-10 h-10 text-amber-400" aria-hidden />
          </div>
          <h2 className="text-lg font-semibold text-white">Нет доступа к данным организации</h2>
          <p className="text-sm text-[#d4d4d8] leading-relaxed">
            API отвечает, но подписка для текущего tenant не загрузилась. Так бывает, если не выбран
            клиент после входа из супер-админки, неверный ключ <code className="text-xs">X-Api-Key</code> или
            сервер недоступен.
          </p>
          <p className="text-xs text-[#a1a1aa] font-mono break-words bg-black/30 rounded-lg px-3 py-2">
            {error}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <button
              type="button"
              onClick={() => void refresh()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white text-zinc-950 text-sm font-semibold px-4 py-2.5 hover:bg-zinc-200"
            >
              <RefreshCw className="w-4 h-4" />
              Повторить загрузку
            </button>
            <Link
              href={superApp}
              className="inline-flex items-center justify-center rounded-xl border border-zinc-600 text-zinc-200 text-sm font-medium px-4 py-2.5 hover:bg-zinc-800"
            >
              Супер-админка (организации)
            </Link>
          </div>
          <p className="text-[11px] text-zinc-500">
            Организацию создаёт владелец платформы; для доступа к данным нужен пароль панели или одноразовая
            ссылка из супер-админки.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
