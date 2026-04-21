/**
 * При смене API URL или NEXT_PUBLIC_SESSION_EPOCH сбрасываем сессию портала,
 * чтобы после сброса БД или смены окружения не оставаться «в чужом» аккаунте.
 */
import { clearImpersonation } from '@/lib/impersonation';
import { clearTenantSession } from '@/lib/tenant-auth';

const BINDING_KEY = 'linearize_binding_v1';

export function getSessionBindingFingerprint(): string {
  const api = process.env.NEXT_PUBLIC_API_URL?.trim() || '';
  const epoch = process.env.NEXT_PUBLIC_SESSION_EPOCH?.trim() || '';
  return `${api}|${epoch}`;
}

/** Вызывать один раз при монтировании клиента. */
export function applyUserDashboardSessionBinding(): void {
  if (typeof window === 'undefined') return;
  const next = getSessionBindingFingerprint();
  const prev = sessionStorage.getItem(BINDING_KEY);
  if (prev === next) return;
  if (prev != null) {
    clearTenantSession();
    clearImpersonation();
  }
  sessionStorage.setItem(BINDING_KEY, next);
}
