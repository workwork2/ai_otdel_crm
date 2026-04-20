/**
 * Демо-данные супер-админки. В проде — API / БД.
 */

export type TenantStatus = 'trial' | 'active' | 'past_due' | 'frozen';

export interface SuperTenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: TenantStatus;
  registeredAt: string;
  mrrRub: number;
  generatedMessages30d: number;
  generatedRevenue30dRub: number;
}

export interface SuperGlobalMetrics {
  totalMrrRub: number;
  totalMessagesGenerated: number;
  apiClaudeSpendUsd: number;
  totalGeneratedRevenueRub: number;
  activeTenants: number;
  frozenTenants: number;
}

export interface AIErrorLogRow {
  id: string;
  at: string;
  tenantName: string;
  model: string;
  snippet: string;
  kind: 'hallucination' | 'refusal' | 'parse' | 'timeout';
}

export interface IntegrationErrorRow {
  id: string;
  at: string;
  tenantName: string;
  channel: string;
  detail: string;
}

export interface QueueStat {
  channel: string;
  pending: number;
  sending: number;
  failed24h: number;
}

export const SUPER_GLOBAL_METRICS: SuperGlobalMetrics = {
  totalMrrRub: 2_847_000,
  totalMessagesGenerated: 12_400_000,
  apiClaudeSpendUsd: 18_420,
  totalGeneratedRevenueRub: 148_200_000,
  activeTenants: 42,
  frozenTenants: 3,
};

export const SUPER_TENANTS: SuperTenant[] = [
  {
    id: 't_aurora',
    name: 'Аврора Ритейл',
    slug: 'aurora',
    plan: 'Enterprise',
    status: 'active',
    registeredAt: '2025-08-12',
    mrrRub: 420_000,
    generatedMessages30d: 890_000,
    generatedRevenue30dRub: 12_400_000,
  },
  {
    id: 't_lumen',
    name: 'Lumen Dental',
    slug: 'lumen',
    plan: 'Pro',
    status: 'active',
    registeredAt: '2025-11-03',
    mrrRub: 89_000,
    generatedMessages30d: 210_000,
    generatedRevenue30dRub: 2_100_000,
  },
  {
    id: 't_nova',
    name: 'Nova B2B',
    slug: 'nova',
    plan: 'Pro',
    status: 'past_due',
    registeredAt: '2024-04-20',
    mrrRub: 120_000,
    generatedMessages30d: 45_000,
    generatedRevenue30dRub: 890_000,
  },
  {
    id: 't_delta',
    name: 'Дельта Авто',
    slug: 'delta',
    plan: 'Starter',
    status: 'frozen',
    registeredAt: '2025-02-01',
    mrrRub: 0,
    generatedMessages30d: 0,
    generatedRevenue30dRub: 0,
  },
  {
    id: 't_mira',
    name: 'Мира Фитнес',
    slug: 'mira',
    plan: 'Trial',
    status: 'trial',
    registeredAt: '2026-03-28',
    mrrRub: 0,
    generatedMessages30d: 12_400,
    generatedRevenue30dRub: 180_000,
  },
];

export const AI_ERROR_LOGS: AIErrorLogRow[] = [
  {
    id: '1',
    at: '2026-04-20T14:22:00',
    tenantName: 'Аврора Ритейл',
    model: 'claude-3-5-sonnet',
    snippet: 'Упомянут несуществующий артикул SKU-99999 как «в наличии»',
    kind: 'hallucination',
  },
  {
    id: '2',
    at: '2026-04-20T11:05:00',
    tenantName: 'Lumen Dental',
    model: 'claude-3-5-sonnet',
    snippet: 'Ответ обрезан по max_tokens, JSON не распарсен',
    kind: 'parse',
  },
  {
    id: '3',
    at: '2026-04-19T09:40:00',
    tenantName: 'Nova B2B',
    model: 'claude-3-haiku',
    snippet: 'Таймаут upstream 30s',
    kind: 'timeout',
  },
];

export const INTEGRATION_ERRORS: IntegrationErrorRow[] = [
  {
    id: '1',
    at: '2026-04-20T15:01:00',
    tenantName: 'Дельта Авто',
    channel: 'WhatsApp',
    detail: 'OAuth token expired (reauthorize WABA)',
  },
  {
    id: '2',
    at: '2026-04-20T12:18:00',
    tenantName: 'Мира Фитнес',
    channel: 'RetailCRM',
    detail: '401 Unauthorized — API key rotated',
  },
  {
    id: '3',
    at: '2026-04-19T18:44:00',
    tenantName: 'Nova B2B',
    channel: 'MAX (VK)',
    detail: 'Rate limit 429, backoff 15 min',
  },
];

export const QUEUE_STATS: QueueStat[] = [
  { channel: 'WhatsApp', pending: 12_400, sending: 890, failed24h: 42 },
  { channel: 'Telegram', pending: 3_200, sending: 120, failed24h: 8 },
  { channel: 'SMS', pending: 890, sending: 45, failed24h: 3 },
  { channel: 'Email', pending: 21_000, sending: 340, failed24h: 12 },
];

export const DEFAULT_MASTER_PROMPT = `Ты — ассистент AI Отдела. Соблюдай тон бренда клиента, не выдумывай скидки и остатки без данных из CRM.
Всегда уточняй источник фактов. Если данных нет — так и скажи.`;

export const IMPERSONATE_KEY = 'super_admin_impersonate';

export type ImpersonationPayload = { tenantId: string; tenantName: string };

export function setImpersonation(payload: ImpersonationPayload): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(IMPERSONATE_KEY, JSON.stringify(payload));
}

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

export const MASTER_PROMPT_KEY = 'super_master_prompt';
export const TENANT_OVERRIDES_KEY = 'super_tenant_status_overrides';

export function readTenantOverrides(): Record<string, TenantStatus> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(TENANT_OVERRIDES_KEY);
    if (raw) return JSON.parse(raw) as Record<string, TenantStatus>;
  } catch {
    /* ignore */
  }
  return {};
}

export function writeTenantOverrides(o: Record<string, TenantStatus>): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TENANT_OVERRIDES_KEY, JSON.stringify(o));
}

/** Блокировка чата техподдержки в панели клиента (tenantId → заблокирован) */
export const TENANT_CHAT_BLOCKS_KEY = 'super_tenant_chat_blocks';

export function readChatBlocks(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(TENANT_CHAT_BLOCKS_KEY);
    if (raw) return JSON.parse(raw) as Record<string, boolean>;
  } catch {
    /* ignore */
  }
  return {};
}

export function writeChatBlocks(o: Record<string, boolean>): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TENANT_CHAT_BLOCKS_KEY, JSON.stringify(o));
}

export type OnboardingStage = 'paid' | 'workspace_ready' | 'invite_sent' | 'active';

export interface OnboardingRow {
  id: string;
  companyName: string;
  email: string;
  planPaid: string;
  amountRub: number;
  paidAt: string;
  stage: OnboardingStage;
}

export const ONBOARDING_QUEUE: OnboardingRow[] = [
  {
    id: 'ob_1',
    companyName: 'Север Логистик',
    email: 'pay@sever-log.ru',
    planPaid: 'Pro (год)',
    amountRub: 948_000,
    paidAt: '2026-04-20T10:15:00',
    stage: 'paid',
  },
  {
    id: 'ob_2',
    companyName: 'Кофе Точка',
    email: 'owner@coffeepoint.ru',
    planPaid: 'Starter (мес.)',
    amountRub: 29_900,
    paidAt: '2026-04-19T16:40:00',
    stage: 'workspace_ready',
  },
  {
    id: 'ob_3',
    companyName: 'Vita Clinic',
    email: 'admin@vita.ru',
    planPaid: 'Enterprise',
    amountRub: 2_400_000,
    paidAt: '2026-04-18T09:00:00',
    stage: 'invite_sent',
  },
];

export const ONBOARDING_STAGE_KEY = 'super_onboarding_stages';

export function readOnboardingStages(): Record<string, OnboardingStage> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(ONBOARDING_STAGE_KEY);
    if (raw) return JSON.parse(raw) as Record<string, OnboardingStage>;
  } catch {
    /* ignore */
  }
  return {};
}

export function writeOnboardingStages(o: Record<string, OnboardingStage>): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ONBOARDING_STAGE_KEY, JSON.stringify(o));
}

export interface SupportMessage {
  id: string;
  from: 'user' | 'admin';
  text: string;
  at: string;
}

export interface SupportTicket {
  id: string;
  tenantId: string;
  tenantName: string;
  subject: string;
  priority: 'low' | 'normal' | 'high';
  status: 'open' | 'pending' | 'resolved';
  updatedAt: string;
  messages: SupportMessage[];
}

export const SUPPORT_TICKETS_SEED: SupportTicket[] = [
  {
    id: 'sup_1',
    tenantId: 't_aurora',
    tenantName: 'Аврора Ритейл',
    subject: 'Не подключается WhatsApp Business',
    priority: 'high',
    status: 'open',
    updatedAt: '2026-04-20T14:20:00',
    messages: [
      {
        id: 'm1',
        from: 'user',
        text: 'После оплаты не могу пройти OAuth в WABA, кнопка серая.',
        at: '2026-04-20T14:05:00',
      },
    ],
  },
  {
    id: 'sup_2',
    tenantId: 't_lumen',
    tenantName: 'Lumen Dental',
    subject: 'Импорт Excel — лишняя колонка',
    priority: 'normal',
    status: 'pending',
    updatedAt: '2026-04-19T11:00:00',
    messages: [
      {
        id: 'm2',
        from: 'user',
        text: 'Колонка «комментарий» попала в телефон, можно ли сопоставить вручную?',
        at: '2026-04-19T10:30:00',
      },
      {
        id: 'm3',
        from: 'admin',
        text: 'Да, в настройках импорта откройте сопоставление полей и перетащите колонку.',
        at: '2026-04-19T11:00:00',
      },
    ],
  },
  {
    id: 'sup_3',
    tenantId: 't_mira',
    tenantName: 'Мира Фитнес',
    subject: 'Вопрос по тарифу после trial',
    priority: 'low',
    status: 'open',
    updatedAt: '2026-04-20T09:12:00',
    messages: [
      {
        id: 'm4',
        from: 'user',
        text: 'Trial заканчивается завтра, как автоматически перейти на Pro?',
        at: '2026-04-20T09:12:00',
      },
    ],
  },
];

export const SUPPORT_TICKETS_STORAGE_KEY = 'super_support_tickets_v1';
