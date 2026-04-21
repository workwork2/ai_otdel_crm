/**
 * Ключи localStorage, привязанные к организации. При выходе из кабинета очищаются вместе с сессией.
 */
export const SUPPORT_CHAT_STORAGE_PREFIX = 'linearize-support-chat:';
/** Старый общий ключ — мигрируем и удаляем, чтобы чат не «перетекал» между аккаунтами. */
export const SUPPORT_CHAT_LEGACY_KEY = 'aura-support-chat-v1';

export function supportChatStorageKey(tenantId: string): string {
  return `${SUPPORT_CHAT_STORAGE_PREFIX}${tenantId.trim()}`;
}

export function clearTenantLocalStorage(tenantId: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (tenantId?.trim()) {
      localStorage.removeItem(supportChatStorageKey(tenantId));
    }
    localStorage.removeItem(SUPPORT_CHAT_LEGACY_KEY);
  } catch {
    /* quota / private mode */
  }
}
