/**
 * Ключ совпадает с super-admin (`super_tenant_chat_blocks`).
 * На одном origin (прод) блокировка из админки видна здесь. Разные порты localhost — разный storage.
 */
import { readImpersonation } from '@/lib/impersonation';
import { getStoredTenantId } from '@/lib/tenant-auth';

export const CHAT_BLOCKS_STORAGE_KEY = 'super_tenant_chat_blocks';

export function isSupportChatBlocked(): boolean {
  if (typeof window === 'undefined') return false;
  const imp = readImpersonation();
  const tid =
    imp?.tenantId ||
    getStoredTenantId()?.trim() ||
    (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_DEMO_TENANT_ID : undefined);
  if (!tid) return false;
  try {
    const raw = localStorage.getItem(CHAT_BLOCKS_STORAGE_KEY);
    if (!raw) return false;
    const o = JSON.parse(raw) as Record<string, boolean>;
    return !!o[tid];
  } catch {
    return false;
  }
}
