'use client';

import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TOAST_EVENT, type ToastDetail } from '@/lib/toast';

export function ToastHost() {
  const [open, setOpen] = useState<ToastDetail | null>(null);

  useEffect(() => {
    const onToast = (e: Event) => {
      const ce = e as CustomEvent<ToastDetail>;
      if (ce.detail?.message) setOpen(ce.detail);
    };
    window.addEventListener(TOAST_EVENT, onToast);
    return () => window.removeEventListener(TOAST_EVENT, onToast);
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => setOpen(null), 5200);
    return () => clearTimeout(t);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed bottom-4 left-1/2 z-[200] flex w-[min(100vw-2rem,420px)] -translate-x-1/2 toast-pop"
      role="status"
    >
      <div
        className={cn(
          'flex-1 flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-sm',
          open.variant === 'error' &&
            'border-red-500/40 bg-red-950/90 text-red-100',
          open.variant === 'success' &&
            'border-emerald-500/35 bg-emerald-950/90 text-emerald-50',
          open.variant === 'info' && 'border-zinc-600 bg-zinc-900/95 text-zinc-100'
        )}
      >
        <p className="text-sm leading-snug flex-1">{open.message}</p>
        <button
          type="button"
          onClick={() => setOpen(null)}
          className="shrink-0 rounded-md p-1 text-current opacity-70 hover:opacity-100"
          aria-label="Закрыть"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
