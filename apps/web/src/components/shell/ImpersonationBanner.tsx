'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Eye, X } from 'lucide-react';
import {
  clearImpersonation,
  readImpersonation,
  type ImpersonationPayload,
} from '@/lib/impersonation';
import { PLATFORM_BASE } from '@/lib/platform-routes';

export function ImpersonationBanner() {
  const [payload, setPayload] = useState<ImpersonationPayload | null>(null);

  useEffect(() => {
    setPayload(readImpersonation());
  }, []);

  if (!payload) return null;

  return (
    <div
      role="status"
      className="shrink-0 border-b border-violet-500/35 bg-violet-950/40 px-3 sm:px-4 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[12px] sm:text-[13px] z-40"
    >
      <div className="flex items-center gap-2 text-violet-100 min-w-0">
        <Eye className="w-4 h-4 text-violet-400 shrink-0" aria-hidden />
        <span className="truncate">
          <span className="font-semibold text-white">God mode:</span> вы смотрите аккаунт «
          {payload.tenantName}»
          <span className="font-mono text-violet-300/90 ml-1 hidden sm:inline">({payload.tenantId})</span>
        </span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <a
          href={
            typeof process !== 'undefined' && process.env.NEXT_PUBLIC_SUPER_APP_URL
              ? `${process.env.NEXT_PUBLIC_SUPER_APP_URL.replace(/\/$/, '')}/tenants`
              : `${PLATFORM_BASE}/tenants`
          }
          className="text-violet-300 hover:text-white font-medium underline-offset-2 hover:underline"
        >
          Супер-админка
        </a>
        <button
          type="button"
          onClick={() => {
            clearImpersonation();
            window.location.href = '/';
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600/80 hover:bg-violet-500 text-white text-xs font-semibold px-3 py-1.5 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          Выйти из аккаунта
        </button>
      </div>
    </div>
  );
}
