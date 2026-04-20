/**
 * Общий контракт с супер-админкой: ключ sessionStorage должен совпадать.
 */

export const IMPERSONATE_KEY = 'super_admin_impersonate';

export type ImpersonationPayload = { tenantId: string; tenantName: string };

export function clearImpersonation(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(IMPERSONATE_KEY);
}

export function readImpersonation(): ImpersonationPayload | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(IMPERSONATE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as ImpersonationPayload;
    if (p?.tenantId && p?.tenantName) return p;
  } catch {
    /* ignore */
  }
  return null;
}
