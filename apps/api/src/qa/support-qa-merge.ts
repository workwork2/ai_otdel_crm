import type { JsonRecord, TenantWorkspace } from '../store/store.types';

/** Синтетический диалог QA — зеркало `supportChat`; не хранить отдельно в БД, собирать при отдаче. */
export const SUPPORT_QA_DIALOGUE_ID = '__platform_support_v1';

export function buildSupportQaDialogue(
  supportChat: TenantWorkspace['supportChat']
): JsonRecord {
  const messages = supportChat.map((m) => {
    const text = (m.text ?? '').trim();
    const img = m.images?.length ? ` [${m.images.length} влож.]` : '';
    const content = `${text}${img}`.trim() || '—';
    return {
      id: m.id,
      date: new Date(m.ts).toISOString().slice(0, 16).replace('T', ' '),
      sender: m.role === 'user' ? 'client' : 'system',
      content,
    };
  });
  const last = supportChat.length ? supportChat[supportChat.length - 1]! : null;
  const updatedAt = last
    ? new Date(last.ts).toISOString().slice(0, 19)
    : new Date().toISOString().slice(0, 19);
  return {
    id: SUPPORT_QA_DIALOGUE_ID,
    client: 'Поддержка платформы',
    clientInitials: 'ТП',
    channel: 'support',
    status: 'active',
    issue: 'Чат с техподдержкой (раздел «Поддержка»)',
    updatedAt,
    messages,
  };
}

/** Убирает старый синтетический ряд и добавляет актуальный из чата поддержки. */
export function mergeQaDialoguesWithSupportChat(
  qaDialogues: JsonRecord[],
  supportChat: TenantWorkspace['supportChat']
): JsonRecord[] {
  const rest = qaDialogues.filter((d) => String((d as { id?: string }).id) !== SUPPORT_QA_DIALOGUE_ID);
  return [...rest, buildSupportQaDialogue(supportChat)];
}

/** Перед сохранением QA из клиента — не писать синтетический id в workspace (источник правды — supportChat). */
export function stripSyntheticSupportDialogue(body: JsonRecord[]): JsonRecord[] {
  return body.filter((d) => String((d as { id?: string }).id) !== SUPPORT_QA_DIALOGUE_ID);
}
