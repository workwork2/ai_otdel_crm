'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { apiFetchJson } from '@/lib/api-client';
import { getApiBaseUrl, getTenantIdClient, tenantFetchHeaders } from '@/lib/backend-api';
import { pushToast } from '@/lib/toast';

export type PlanEntitlements = {
  maxActiveAutomations: number;
  excelImport: boolean;
  qaFullAccess: boolean;
  analyticsAdvanced: boolean;
  aiRefineCopy: boolean;
  integrationsManage: boolean;
  maxChannel: boolean;
  exportReports: boolean;
};

export type BillingDto = {
  planKey: string;
  planLabel: string;
  priceRubMonthly: number;
  validUntil: string;
  messagesUsed: number;
  messagesLimit: number;
  audienceUsed: number;
  audienceLimit: number;
  invoices: Array<{ date: string; doc: string; amountRub: number; status: string }>;
};

export type SubscriptionPayload = {
  planKey: string;
  planLabel: string;
  billing: BillingDto;
  entitlements: PlanEntitlements;
};

type Ctx = {
  loading: boolean;
  subscription: SubscriptionPayload | null;
  error: string | null;
  refresh: () => Promise<void>;
  has: (k: keyof PlanEntitlements) => boolean;
  /** Демо: смена тарифа с клиентской панели */
  setPlan: (planKey: string) => Promise<boolean>;
};

const SubscriptionContext = createContext<Ctx | null>(null);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [tenantId, setTenantId] = useState(() => getTenantIdClient());
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const refresh = useCallback(async () => {
    const base = getApiBaseUrl();
    if (!base) {
      setSubscription(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    const url = `${base}/v1/tenant/${tenantId}/subscription`;
    const res = await apiFetchJson<SubscriptionPayload>(url, {
      headers: tenantFetchHeaders(),
      retries: 2,
      silent: true,
    });
    if (res.ok) {
      setSubscription(res.data);
      setError(null);
    } else {
      setSubscription(null);
      setError(res.error);
      pushToast(`Тариф: ${res.error}`, 'error');
    }
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const has = useCallback(
    (k: keyof PlanEntitlements) => {
      if (!subscription) return true;
      return !!subscription.entitlements[k];
    },
    [subscription]
  );

  const setPlan = useCallback(
    async (planKey: string) => {
      const base = getApiBaseUrl();
      if (!base) {
        pushToast('API не настроен (NEXT_PUBLIC_API_URL)', 'error');
        return false;
      }
      const res = await apiFetchJson<SubscriptionPayload>(
        `${base}/v1/tenant/${tenantId}/billing/plan`,
        {
          method: 'PATCH',
          headers: { ...tenantFetchHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ planKey }),
          retries: 1,
        }
      );
      if (res.ok) {
        setSubscription(res.data);
        pushToast(`Тариф: ${res.data.planLabel}`, 'success');
        return true;
      }
      return false;
    },
    [tenantId]
  );

  const value = useMemo(
    () => ({ loading, subscription, error, refresh, has, setPlan }),
    [loading, subscription, error, refresh, has, setPlan]
  );

  return (
    <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>
  );
}

export function useSubscription(): Ctx {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription requires SubscriptionProvider');
  return ctx;
}

/** Без ошибки вне провайдера (для общих компонентов). */
export function useSubscriptionOptional(): Ctx | null {
  return useContext(SubscriptionContext);
}
