import { clearPlatformJwt } from '@/lib/platform-auth';

const BINDING_KEY = 'linearize_binding_v1';

export function getSessionBindingFingerprint(): string {
  const api = process.env.NEXT_PUBLIC_API_URL?.trim() || '';
  const epoch = process.env.NEXT_PUBLIC_SESSION_EPOCH?.trim() || '';
  return `${api}|${epoch}`;
}

export function applySuperAdminSessionBinding(): void {
  if (typeof window === 'undefined') return;
  const next = getSessionBindingFingerprint();
  const prev = sessionStorage.getItem(BINDING_KEY);
  if (prev === next) return;
  if (prev != null) {
    clearPlatformJwt();
  }
  sessionStorage.setItem(BINDING_KEY, next);
}
