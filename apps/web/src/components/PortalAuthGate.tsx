'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { getApiBaseUrl } from '@/lib/backend-api';
import { getTenantJwt } from '@/lib/tenant-auth';

/**
 * CRM доступна только с JWT организации (вход на /login).
 */
export function PortalAuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const api = getApiBaseUrl();
    if (!api) {
      router.replace('/login');
      return;
    }
    if (!getTenantJwt()) {
      router.replace(`/login?next=${encodeURIComponent(pathname || '/')}`);
      return;
    }
    setReady(true);
  }, [router, pathname]);

  if (!ready) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[40vh] text-zinc-500 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Проверка доступа…</span>
      </div>
    );
  }

  return <>{children}</>;
}
