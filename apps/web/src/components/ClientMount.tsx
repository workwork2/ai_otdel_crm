'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Recharts ResponsiveContainer измеряется в браузере; при SSG у контейнера 0×0 и в логах шум.
 * Пока нет mount — показываем спокойный плейсхолдер той же высоты.
 */
export function ClientMount({
  children,
  minHeight = 200,
  className,
}: {
  children: React.ReactNode;
  minHeight?: number;
  className?: string;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
  }, []);
  if (!ready) {
    return (
      <div
        className={cn('w-full rounded-lg bg-[#121214]/80 border border-[#1f1f22]/80', className)}
        style={{ minHeight }}
        aria-hidden
      />
    );
  }
  return <>{children}</>;
}
