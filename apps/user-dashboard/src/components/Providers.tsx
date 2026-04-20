'use client';

import React from 'react';
import { AudienceDataProvider } from '@/context/AudienceDataContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return <AudienceDataProvider>{children}</AudienceDataProvider>;
}
