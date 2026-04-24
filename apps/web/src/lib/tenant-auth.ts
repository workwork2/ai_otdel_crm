import { clearImpersonation } from '@/lib/impersonation';
import { clearTenantLocalStorage } from '@/lib/tenant-local-storage';

const JWT_KEY = 'linearize_tenant_jwt';
const TENANT_ID_KEY = 'linearize_tenant_id';

export function getTenantJwt(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(JWT_KEY);
}

export function setTenantSession(accessToken: string, tenantId: string) {
  sessionStorage.setItem(JWT_KEY, accessToken);
  sessionStorage.setItem(TENANT_ID_KEY, tenantId);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('linearize-tenant-auth'));
  }
}

export function clearTenantSession() {
  const tid = getStoredTenantId();
  sessionStorage.removeItem(JWT_KEY);
  sessionStorage.removeItem(TENANT_ID_KEY);
  clearTenantLocalStorage(tid);
  clearImpersonation();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('linearize-tenant-auth'));
  }
}

export function getStoredTenantId(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(TENANT_ID_KEY);
}
