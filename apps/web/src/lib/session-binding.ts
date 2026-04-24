/**
 * При смене API URL или NEXT_PUBLIC_SESSION_EPOCH сбрасываем сессии,
 * чтобы после сброса БД или смены окружения не оставаться в чужом аккаунте.
 */
import { clearImpersonation } from '@/lib/impersonation';
import { clearPlatformJwt } from '@/lib/platform-auth';
import { clearTenantSession } from '@/lib/tenant-auth';

const BINDING_KEY = 'linearize_binding_v1';

export function getSessionBindingFingerprint(): string {
  const api = process.env.NEXT_PUBLIC_API_URL?.trim() || '';
  const epoch = process.env.NEXT_PUBLIC_SESSION_EPOCH?.trim() || '';
  return `${api}|${epoch}`;
}

/** Один раз при монтировании корневого клиента (портал + platform). */
export function applyWebSessionBinding(): void {
  if (typeof window === 'undefined') return;
  const next = getSessionBindingFingerprint();
  const prev = sessionStorage.getItem(BINDING_KEY);
  if (prev === next) return;
  if (prev != null) {
    clearTenantSession();
    clearImpersonation();
    clearPlatformJwt();
  }
  sessionStorage.setItem(BINDING_KEY, next);
}

/** @deprecated используйте applyWebSessionBinding */
export const applyUserDashboardSessionBinding = applyWebSessionBinding;
