/** Метаданные платформы и список tenants при первом создании БД — без выдуманных цифр и строк. */

export type TenantStatus = 'trial' | 'active' | 'past_due' | 'frozen';

export const SUPER_GLOBAL_METRICS = {
  totalMrrRub: 0,
  totalMessagesGenerated: 0,
  apiClaudeSpendUsd: 0,
  totalGeneratedRevenueRub: 0,
  activeTenants: 0,
  frozenTenants: 0,
};

/**
 * При первом старте с пустой БД tenants не создаются — только через супер-админку.
 * Локально после `CONFIRM_RESET=1 npm run db:reset` каталог пустой до создания организации.
 */
export const SUPER_TENANT_ROWS: Array<{
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: TenantStatus;
  registeredAt: string;
  mrrRub: number;
  generatedMessages30d: number;
  generatedRevenue30dRub: number;
}> = [];

export const AI_ERROR_LOGS: unknown[] = [];

export const INTEGRATION_ERRORS: unknown[] = [];

export const QUEUE_STATS: unknown[] = [];

export const DEFAULT_MASTER_PROMPT = `Ты — ассистент AI Отдела. Соблюдай тон бренда клиента, не выдумывай скидки и остатки без данных из CRM.
Всегда уточняй источник фактов. Если данных нет — так и скажи.`;

export type OnboardingStage = 'paid' | 'workspace_ready' | 'invite_sent' | 'active';

export const ONBOARDING_QUEUE: unknown[] = [];

export const SUPPORT_TICKETS_SEED: unknown[] = [];

export const SUBSCRIPTION_PLANS_DOC = [
  {
    id: 'trial',
    name: 'Trial',
    summary: 'Пробный период: полный набор функций панели (Excel, аналитика, QA, интеграции) в лимитах тарифа.',
    priceRubMonthly: 0,
    limits: { messagesPerMonth: 500, audienceContacts: 2000, channels: ['whatsapp', 'telegram', 'sms', 'email', 'max'] },
    highlights: ['Импорт Excel и отчёты', 'Сценарии и QA', 'Интеграции в демо-режиме'],
  },
  {
    id: 'starter',
    name: 'Starter',
    summary: 'Малый бизнес и пилоты: один бренд, ключевые каналы, доступный входной тариф.',
    priceRubMonthly: 4_990,
    limits: { messagesPerMonth: 25_000, audienceContacts: 50_000, channels: ['whatsapp', 'telegram', 'sms', 'email'] },
    highlights: ['CRM / импорт базы', 'Очередь касаний EES', 'ИИ-тексты и QA'],
  },
  {
    id: 'business_plus',
    name: 'Business Plus',
    summary: 'Расширенная аналитика, больше параллельных сценариев, приоритет в поддержке.',
    priceRubMonthly: 9_900,
    limits: { messagesPerMonth: 80_000, audienceContacts: 120_000, channels: ['whatsapp', 'telegram', 'sms', 'email'] },
    highlights: ['Расширенная аналитика и воронка', 'До 12 активных сценариев', 'Апгрейд до Pro в один клик'],
  },
  {
    id: 'pro',
    name: 'Pro',
    summary: 'Сети и e-com: высокие лимиты, канал MAX, приоритет в очереди.',
    priceRubMonthly: 19_900,
    limits: { messagesPerMonth: 150_000, audienceContacts: 250_000, channels: ['whatsapp', 'telegram', 'sms', 'email', 'max'] },
    highlights: ['Несколько сценариев в параллель', 'Контроль качества QA', 'Расширенные отчёты'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    summary: 'Кастомные лимиты, SSO, отдельный контур данных, опционально on-premise.',
    priceRubMonthly: null as number | null,
    limits: { messagesPerMonth: null as number | null, audienceContacts: null as number | null, channels: ['all'] },
    highlights: ['Индивидуальный договор', 'Выделенные очереди', 'Интеграции под ключ'],
  },
];
