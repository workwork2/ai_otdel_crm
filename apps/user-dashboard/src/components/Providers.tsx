'use client';

import React from 'react';
import { AudienceDataProvider } from '@/context/AudienceDataContext';
import { SubscriptionProvider } from '@/context/SubscriptionContext';
import { ToastHost } from '@/components/ToastHost';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SubscriptionProvider>
      <AudienceDataProvider>
        {children}
        <ToastHost />
      </AudienceDataProvider>
    </SubscriptionProvider>
  );
}
