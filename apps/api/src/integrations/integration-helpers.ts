import type { JsonRecord, TenantWorkspace } from '../store/store.types';

/** Маска в ответе API; при сохранении пусто или маска = не менять секрет на сервере. */
export const INTEGRATION_SECRET_MASK = '********';

export type IntegrationRow = TenantWorkspace['integrations'][number];

const CATALOG: Array<Pick<IntegrationRow, 'id' | 'name' | 'category'>> = [
  { id: 'crm-1c', name: '1С:Предприятие', category: 'crm' },
  { id: 'crm-yclients', name: 'YCLIENTS', category: 'crm' },
  { id: 'crm-retail', name: 'RetailCRM', category: 'crm' },
  { id: 'crm-iiko', name: 'iiko / r_keeper', category: 'crm' },
  { id: 'ch-wa', name: 'WhatsApp Business', category: 'channel' },
  { id: 'ch-tg', name: 'Telegram', category: 'channel' },
  { id: 'ch-sms', name: 'SMS', category: 'channel' },
  { id: 'ch-email', name: 'Email', category: 'channel' },
  { id: 'ch-max', name: 'MAX (VK)', category: 'channel' },
];

const CATALOG_IDS = new Set(CATALOG.map((c) => c.id));

function cloneConfig(c: JsonRecord | undefined): JsonRecord | undefined {
  if (!c || typeof c !== 'object') return undefined;
  return { ...c };
}

function sanitizeConfig(c: JsonRecord | undefined): JsonRecord | undefined {
  const cfg = cloneConfig(c);
  if (!cfg) return undefined;
  if (cfg.smtpPass && String(cfg.smtpPass).length > 0) cfg.smtpPass = INTEGRATION_SECRET_MASK;
  if (cfg.apiKey && String(cfg.apiKey).length > 0) cfg.apiKey = INTEGRATION_SECRET_MASK;
  if (cfg.webhookSecret && String(cfg.webhookSecret).length > 0) {
    cfg.webhookSecret = INTEGRATION_SECRET_MASK;
  }
  return Object.keys(cfg).length ? cfg : undefined;
}

function sanitizeRow(row: IntegrationRow): IntegrationRow {
  return {
    ...row,
    config: sanitizeConfig(row.config as JsonRecord | undefined),
  };
}

/** Объединить сохранённое состояние с полным каталогом + кастомные строки. */
export function mergeIntegrationsForClient(saved: IntegrationRow[]): IntegrationRow[] {
  const byId = new Map(saved.map((s) => [s.id, s]));
  const merged: IntegrationRow[] = CATALOG.map((c) => {
    const s = byId.get(c.id);
    return sanitizeRow({
      ...c,
      status: s?.status ?? 'available',
      config: s?.config,
    });
  });
  for (const s of saved) {
    if (!CATALOG_IDS.has(s.id)) {
      merged.push(sanitizeRow(s));
    }
  }
  return merged;
}

function shouldKeepSecret(incoming: unknown): boolean {
  if (incoming === undefined || incoming === null) return true;
  const s = String(incoming).trim();
  return s === '' || s === INTEGRATION_SECRET_MASK;
}

/** Не затирать пароли/API-ключи, если клиент прислал пустое или маску. */
export function mergeIntegrationsPreserveSecrets(
  prev: IntegrationRow[],
  incoming: IntegrationRow[]
): IntegrationRow[] {
  const prevById = new Map(prev.map((p) => [p.id, p]));
  return incoming.map((row) => {
    const p = prevById.get(row.id);
    const nextCfg = cloneConfig(row.config as JsonRecord | undefined) ?? {};
    const oldCfg = (p?.config ?? {}) as JsonRecord;
    if (shouldKeepSecret(nextCfg.smtpPass) && oldCfg.smtpPass) {
      nextCfg.smtpPass = oldCfg.smtpPass;
    }
    if (shouldKeepSecret(nextCfg.apiKey) && oldCfg.apiKey) {
      nextCfg.apiKey = oldCfg.apiKey;
    }
    if (shouldKeepSecret(nextCfg.webhookSecret) && oldCfg.webhookSecret) {
      nextCfg.webhookSecret = oldCfg.webhookSecret;
    }
    const config = Object.keys(nextCfg).length ? nextCfg : undefined;
    return { ...row, config };
  });
}

export function getTenantSmtpFromWorkspace(w: TenantWorkspace): {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
  smtpFrom?: string;
} | null {
  const email = w.integrations.find((i) => i.name === 'Email' && i.status === 'connected');
  const c = (email?.config ?? {}) as JsonRecord;
  const host = String(c.smtpHost ?? '').trim();
  const user = String(c.smtpUser ?? '').trim();
  const pass = String(c.smtpPass ?? '').trim();
  if (!host || !user || !pass) return null;
  const port = Math.min(65535, Math.max(1, Number(c.smtpPort) || 587));
  const secure = c.smtpSecure === true || String(c.smtpSecure) === 'true';
  const from = String(c.smtpFrom ?? '').trim() || undefined;
  return { smtpHost: host, smtpPort: port, smtpSecure: secure, smtpUser: user, smtpPass: pass, smtpFrom: from };
}

export function emailChannelReadyForSend(w: TenantWorkspace): boolean {
  return getTenantSmtpFromWorkspace(w) !== null;
}
