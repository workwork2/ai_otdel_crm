import { readImpersonation } from '@/lib/impersonation';

/**
 * Базовый URL API. Явный NEXT_PUBLIC_API_URL имеет приоритет.
 * На localhost без env подключаемся к :3333 — удобно для показа.
 */
export function getApiBaseUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (raw) return raw.replace(/\/$/, '');
  if (typeof window !== 'undefined') {
    const h = window.location.hostname;
    if (h === 'localhost' || h === '127.0.0.1') return 'http://localhost:3333';
  }
  if (process.env.NODE_ENV === 'development') return 'http://localhost:3333';
  return null;
}

export function getTenantIdClient(): string {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_DEMO_TENANT_ID?.trim() || 't_demo';
  }
  const imp = readImpersonation();
  return imp?.tenantId || process.env.NEXT_PUBLIC_DEMO_TENANT_ID?.trim() || 't_demo';
}

export function tenantFetchHeaders(): HeadersInit {
  const h: Record<string, string> = {};
  const key = process.env.NEXT_PUBLIC_TENANT_API_KEY?.trim();
  if (key) h['X-Api-Key'] = key;
  return h;
}

export function jsonTenantHeaders(): HeadersInit {
  return { ...tenantFetchHeaders(), 'Content-Type': 'application/json' };
}
