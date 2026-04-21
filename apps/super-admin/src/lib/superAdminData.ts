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
  totalMrrRub: 0,
  totalMessagesGenerated: 0,
  apiClaudeSpendUsd: 0,
  totalGeneratedRevenueRub: 0,
  activeTenants: 0,
  frozenTenants: 0,
};

/** Пусто: список организаций только с API. */
export const SUPER_TENANTS: SuperTenant[] = [];

export const AI_ERROR_LOGS: AIErrorLogRow[] = [];

export const INTEGRATION_ERRORS: IntegrationErrorRow[] = [];

export const QUEUE_STATS: QueueStat[] = [];

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

export const ONBOARDING_QUEUE: OnboardingRow[] = [];

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

export const SUPPORT_TICKETS_SEED: SupportTicket[] = [];

export const SUPPORT_TICKETS_STORAGE_KEY = 'super_support_tickets_v1';
