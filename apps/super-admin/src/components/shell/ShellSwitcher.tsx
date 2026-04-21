'use client';

import React, { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { SuperAdminShell } from '@/components/shell/SuperAdminShell';
import { applySuperAdminSessionBinding } from '@/lib/session-binding';

export function ShellSwitcher({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    applySuperAdminSessionBinding();
  }, []);

  if (pathname === '/login') {
    return <>{children}</>;
  }
  return <SuperAdminShell>{children}</SuperAdminShell>;
}
