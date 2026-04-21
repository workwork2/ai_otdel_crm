/** Синхронизировано с apps/super-admin/src/lib/superAdminData.ts */

export type TenantStatus = 'trial' | 'active' | 'past_due' | 'frozen';

export const SUPER_GLOBAL_METRICS = {
  totalMrrRub: 2_847_000,
  totalMessagesGenerated: 12_400_000,
  apiClaudeSpendUsd: 18_420,
  totalGeneratedRevenueRub: 148_200_000,
  activeTenants: 42,
  frozenTenants: 3,
};

export const SUPER_TENANT_ROWS = [
  {
    id: 't_demo',
    name: 'Демо: AI Отдел (песочница)',
    slug: 'demo',
    plan: 'Trial',
    status: 'active' as TenantStatus,
    registeredAt: '2026-01-15',
    mrrRub: 14_900,
    generatedMessages30d: 4_200,
    generatedRevenue30dRub: 890_000,
  },
  {
    id: 't_aurora',
    name: 'Аврора Ритейл',
    slug: 'aurora',
    plan: 'Enterprise',
    status: 'active' as TenantStatus,
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
    status: 'active' as TenantStatus,
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
    status: 'past_due' as TenantStatus,
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
    status: 'frozen' as TenantStatus,
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
    status: 'trial' as TenantStatus,
    registeredAt: '2026-03-28',
    mrrRub: 0,
    generatedMessages30d: 12_400,
    generatedRevenue30dRub: 180_000,
  },
];

export const AI_ERROR_LOGS = [
  {
    id: '1',
    at: '2026-04-20T14:22:00',
    tenantName: 'Аврора Ритейл',
    model: 'claude-3-5-sonnet',
    snippet: 'Упомянут несуществующий артикул SKU-99999 как «в наличии»',
    kind: 'hallucination' as const,
  },
  {
    id: '2',
    at: '2026-04-20T11:05:00',
    tenantName: 'Lumen Dental',
    model: 'claude-3-5-sonnet',
    snippet: 'Ответ обрезан по max_tokens, JSON не распарсен',
    kind: 'parse' as const,
  },
  {
    id: '3',
    at: '2026-04-19T09:40:00',
    tenantName: 'Nova B2B',
    model: 'claude-3-haiku',
    snippet: 'Таймаут upstream 30s',
    kind: 'timeout' as const,
  },
];

export const INTEGRATION_ERRORS = [
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

export const QUEUE_STATS = [
  { channel: 'WhatsApp', pending: 12_400, sending: 890, failed24h: 42 },
  { channel: 'Telegram', pending: 3_200, sending: 120, failed24h: 8 },
  { channel: 'SMS', pending: 890, sending: 45, failed24h: 3 },
  { channel: 'Email', pending: 21_000, sending: 340, failed24h: 12 },
];

export const DEFAULT_MASTER_PROMPT = `Ты — ассистент AI Отдела. Соблюдай тон бренда клиента, не выдумывай скидки и остатки без данных из CRM.
Всегда уточняй источник фактов. Если данных нет — так и скажи.`;

export type OnboardingStage = 'paid' | 'workspace_ready' | 'invite_sent' | 'active';

export const ONBOARDING_QUEUE = [
  {
    id: 'ob_1',
    companyName: 'Север Логистик',
    email: 'pay@sever-log.ru',
    planPaid: 'Pro (год)',
    amountRub: 948_000,
    paidAt: '2026-04-20T10:15:00',
    stage: 'paid' as OnboardingStage,
  },
  {
    id: 'ob_2',
    companyName: 'Кофе Точка',
    email: 'owner@coffeepoint.ru',
    planPaid: 'Starter (мес.)',
    amountRub: 29_900,
    paidAt: '2026-04-19T16:40:00',
    stage: 'workspace_ready' as OnboardingStage,
  },
  {
    id: 'ob_3',
    companyName: 'Vita Clinic',
    email: 'admin@vita.ru',
    planPaid: 'Enterprise',
    amountRub: 2_400_000,
    paidAt: '2026-04-18T09:00:00',
    stage: 'invite_sent' as OnboardingStage,
  },
];

export const SUPPORT_TICKETS_SEED = [
  {
    id: 'sup_1',
    tenantId: 't_aurora',
    tenantName: 'Аврора Ритейл',
    subject: 'Не подключается WhatsApp Business',
    priority: 'high' as const,
    status: 'open' as const,
    updatedAt: '2026-04-20T14:20:00',
    messages: [
      {
        id: 'm1',
        from: 'user' as const,
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
    priority: 'normal' as const,
    status: 'pending' as const,
    updatedAt: '2026-04-19T11:00:00',
    messages: [
      {
        id: 'm2',
        from: 'user' as const,
        text: 'Колонка «комментарий» попала в телефон, можно ли сопоставить вручную?',
        at: '2026-04-19T10:30:00',
      },
      {
        id: 'm3',
        from: 'admin' as const,
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
    priority: 'low' as const,
    status: 'open' as const,
    updatedAt: '2026-04-20T09:12:00',
    messages: [
      {
        id: 'm4',
        from: 'user' as const,
        text: 'Trial заканчивается завтра, как автоматически перейти на Pro?',
        at: '2026-04-20T09:12:00',
      },
    ],
  },
];

export const SUBSCRIPTION_PLANS_DOC = [
  {
    id: 'trial',
    name: 'Trial',
    summary: '14 дней полного доступа к сценариям и отчётам в ограниченном объёме.',
    priceRubMonthly: 0,
    limits: { messagesPerMonth: 500, audienceContacts: 2000, channels: ['whatsapp', 'telegram'] },
    highlights: ['Онбординг с менеджером', 'Импорт до 2k контактов', 'Базовые сценарии'],
  },
  {
    id: 'starter',
    name: 'Starter',
    summary: 'Малый бизнес и пилоты: один бренд, ключевые каналы, предсказуемый бюджет.',
    priceRubMonthly: 29_900,
    limits: { messagesPerMonth: 25_000, audienceContacts: 50_000, channels: ['whatsapp', 'telegram', 'sms', 'email'] },
    highlights: ['RetailCRM / Excel', 'Очередь касаний EES', 'Чат поддержки в панели'],
  },
  {
    id: 'pro',
    name: 'Pro',
    summary: 'Растущие сети и e-com: несколько воронок, приоритет в очереди, расширенная аналитика.',
    priceRubMonthly: 89_000,
    limits: { messagesPerMonth: 150_000, audienceContacts: 250_000, channels: ['whatsapp', 'telegram', 'sms', 'email', 'max'] },
    highlights: ['Несколько сценариев в параллель', 'Расширенный контроль качества', 'SLA поддержки'],
  },
  {
    id: 'business_plus',
    name: 'Business Plus',
    summary: 'Как в демо-панели: высокие лимиты сообщений и базы, персональный инженер внедрения.',
    priceRubMonthly: 14_900,
    limits: { messagesPerMonth: 10_000, audienceContacts: 15_000, channels: ['whatsapp', 'telegram', 'sms', 'email'] },
    highlights: ['Лимиты как в экране «Мой тариф»', 'Подходит для одного юрлица', 'Апгрейд до Pro в один клик'],
    note: 'В продукте этот пакет отображается как «Бизнес Плюс» в UI клиента; числа совпадают с демо-экраном биллинга.',
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
