'use client';

import React, { useEffect } from 'react';
import { AudienceDataProvider } from '@/context/AudienceDataContext';
import { SubscriptionProvider } from '@/context/SubscriptionContext';
import { ToastHost } from '@/components/ToastHost';
import { applyUserDashboardSessionBinding } from '@/lib/session-binding';

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    applyUserDashboardSessionBinding();
  }, []);

  return (
    <SubscriptionProvider>
      <AudienceDataProvider>
        {children}
        <ToastHost />
      </AudienceDataProvider>
    </SubscriptionProvider>
  );
}
