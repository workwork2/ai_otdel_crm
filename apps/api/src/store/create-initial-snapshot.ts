import { buildBillingFromPlan } from '../subscription/billing-from-plan';
import {
  AI_ERROR_LOGS,
  DEFAULT_MASTER_PROMPT,
  INTEGRATION_ERRORS,
  ONBOARDING_QUEUE,
  QUEUE_STATS,
  SUBSCRIPTION_PLANS_DOC,
  SUPER_GLOBAL_METRICS,
  SUPER_TENANT_ROWS,
  SUPPORT_TICKETS_SEED,
} from './seed/super.seed';
import type { AppSnapshot, JsonRecord, TenantWorkspace } from './store.types';

const WELCOME_SUPPORT = {
  id: 'welcome',
  role: 'system' as const,
  text: 'Здравствуйте! Опишите проблему или прикрепите скриншоты — сообщения синхронизируются с бэкендом, если включён API.',
  images: [] as string[],
  ts: Date.now(),
};

function defaultBrain(): TenantWorkspace['brain'] {
  return {
    businessVertical: 'mixed',
    tone: 50,
    useEmoji: true,
    maxDiscountPercent: 15,
    spamCadence: 'week',
    systemPrompt:
      'Ты — вежливый ИИ-ассистент бренда. Помогаешь с заказами, акциями и лояльностью. Не обещай то, чего нет в правилах ниже.',
    brandVoicePrompt:
      'Обращайся на «вы», короткие абзацы, без канцелярита. При необходимости уточняй детали заказа.',
    discounts: [],
    promotions: [],
  };
}

function emptyBilling(): TenantWorkspace['billing'] {
  return {
    planKey: 'starter',
    planLabel: 'Starter',
    priceRubMonthly: 4_990,
    validUntil: '2026-12-31',
    messagesUsed: 0,
    messagesLimit: 25_000,
    audienceUsed: 0,
    audienceLimit: 50_000,
    invoices: [],
  };
}

export function emptyWorkspace(): TenantWorkspace {
  return {
    customers: [],
    qaDialogues: [],
    brain: defaultBrain(),
    automations: [],
    integrations: [],
    billing: emptyBilling(),
    supportChat: [{ ...WELCOME_SUPPORT }],
  };
}

export function createInitialSnapshot(): AppSnapshot {
  const tenants: Record<string, TenantWorkspace> = {};

  for (const row of SUPER_TENANT_ROWS) {
    const ws = emptyWorkspace();
    ws.billing = buildBillingFromPlan('trial', {
      messagesUsed: 0,
      audienceUsed: 0,
      validUntil: '2026-12-31',
      invoices: [],
    });
    tenants[row.id] = ws;
  }

  return {
    version: 1,
    tenants,
    super: {
      globalMetrics: { ...SUPER_GLOBAL_METRICS },
      aiErrorLogs: JSON.parse(JSON.stringify(AI_ERROR_LOGS)) as JsonRecord[],
      integrationErrors: JSON.parse(JSON.stringify(INTEGRATION_ERRORS)) as JsonRecord[],
      queueStats: JSON.parse(JSON.stringify(QUEUE_STATS)) as JsonRecord[],
      masterPrompt: DEFAULT_MASTER_PROMPT,
      tenantStatusOverrides: {},
      chatBlocks: {},
      onboarding: JSON.parse(JSON.stringify(ONBOARDING_QUEUE)) as JsonRecord[],
      onboardingStages: {},
      supportTickets: JSON.parse(JSON.stringify(SUPPORT_TICKETS_SEED)) as JsonRecord[],
    },
    subscriptionPlans: JSON.parse(JSON.stringify(SUBSCRIPTION_PLANS_DOC)) as JsonRecord[],
  };
}
