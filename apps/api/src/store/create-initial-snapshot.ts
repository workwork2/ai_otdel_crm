import { buildBillingFromPlan } from '../subscription/billing-from-plan';
import { DEMO_CUSTOMERS, DEMO_QA_DIALOGUES } from './seed/customer-qa.seed';
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
    tone: 50,
    useEmoji: true,
    maxDiscountPercent: 15,
    spamCadence: 'week',
    systemPrompt:
      'Ты — вежливый ИИ-ассистент бренда. Помогаешь с заказами, акциями и лояльностью. Не обещай то, чего нет в правилах ниже.',
    brandVoicePrompt:
      'Обращайся на «вы», короткие абзацы, без канцелярита. При необходимости уточняй детали заказа.',
    discounts: [
      {
        id: 'd1',
        code: 'WELCOME10',
        percent: 10,
        description: 'Приветственная скидка для новых клиентов после первой покупки.',
        active: true,
      },
      {
        id: 'd2',
        code: 'LOYAL15',
        percent: 15,
        description: 'Для уровня «Серебро» и выше на категорию «повторная покупка».',
        active: true,
      },
    ],
    promotions: [
      {
        id: 'p1',
        title: 'Весенняя коллекция',
        body: 'До 30 апреля — вторая позиция в чеке со скидкой 10% при оплате картой.',
        validUntil: '2026-04-30',
        active: true,
      },
      {
        id: 'p2',
        title: 'День рождения',
        body: 'В день и ±3 дня — персональный промокод на 12% на один заказ.',
        validUntil: '2026-12-31',
        active: true,
      },
    ],
  };
}

function defaultAutomations(): TenantWorkspace['automations'] {
  return [
    { id: 'a1', name: 'Реактивация: вернуть ушедших', desc: 'ИИ замечает, если клиент пропал дольше обычного, и пишет ненавязчивое сообщение с поводом вернуться.', tag: 'Retention', status: 'active' },
    { id: 'a2', name: 'NPS и отзывы', desc: 'Через несколько часов после покупки ИИ спрашивает об удовлетворённости и собирает оценки.', tag: 'Voice of customer', status: 'active' },
    { id: 'a3', name: 'Сгорание бонусов / кэшбека', desc: 'Напоминание, если баллы скоро сгорят, с подборкой товаров из каталога.', tag: 'Loyalty', status: 'active' },
    { id: 'a4', name: 'День рождения', desc: 'Поздравление в день рождения с персональным подарком или промокодом.', tag: 'CRM-триггер', status: 'paused' },
    { id: 'a5', name: 'Брошенная корзина', desc: 'Через 2–4 часа после добавления товаров — мягкое напоминание с ссылкой на корзину.', tag: 'E-com', status: 'active' },
    { id: 'a6', name: 'Пост-продажа и допродажа', desc: 'После выдачи заказа — кросс-селл аксессуаров и расходников к купленному.', tag: 'Up-sell', status: 'active' },
    { id: 'a7', name: 'Программа лояльности', desc: 'Автоматическое повышение уровня, напоминание о привилегиях и дедлайнах статуса.', tag: 'Tier', status: 'active' },
    { id: 'a8', name: 'Возврат к сезонному спросу', desc: 'Триггер по категории и календарю: «сезон начался» — персональный оффер.', tag: 'Кампания', status: 'paused' },
    { id: 'a9', name: 'Онбординг нового клиента', desc: 'Цепочка из 3 сообщений: как пользоваться бонусами, доставкой и поддержкой.', tag: 'Welcome', status: 'active' },
    { id: 'a10', name: 'Напоминание о записи / визите', desc: 'За 24 ч и за 2 ч до слота — подтверждение и возможность переноса в один тап.', tag: 'Сервис', status: 'active' },
    { id: 'a11', name: 'Win-back после отписки', desc: 'Если клиент отключил рассылку — одно нейтральное письмо с опросом причины и бонусом за возврат.', tag: 'Churn', status: 'paused' },
  ];
}

function defaultIntegrations(): TenantWorkspace['integrations'] {
  return [
    { id: 'i1', name: '1С:Предприятие', category: 'crm', status: 'connected' },
    { id: 'i2', name: 'YCLIENTS', category: 'crm', status: 'available' },
    { id: 'i3', name: 'RetailCRM', category: 'crm', status: 'available' },
    { id: 'i4', name: 'iiko / r_keeper', category: 'crm', status: 'available' },
    { id: 'i5', name: 'WhatsApp', category: 'channel', status: 'connected' },
    { id: 'i6', name: 'Telegram', category: 'channel', status: 'available' },
    { id: 'i7', name: 'SMS', category: 'channel', status: 'available' },
    { id: 'i8', name: 'Email', category: 'channel', status: 'connected' },
    { id: 'i9', name: 'MAX (VK)', category: 'channel', status: 'available' },
  ];
}

function emptyBilling(): TenantWorkspace['billing'] {
  return {
    planKey: 'starter',
    planLabel: 'Starter',
    priceRubMonthly: 29_900,
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
    qaDialogues: JSON.parse(JSON.stringify(DEMO_QA_DIALOGUES)) as JsonRecord[],
    brain: defaultBrain(),
    automations: defaultAutomations(),
    integrations: defaultIntegrations(),
    billing: emptyBilling(),
    supportChat: [{ ...WELCOME_SUPPORT }],
  };
}

export function createInitialSnapshot(): AppSnapshot {
  const tenants: Record<string, TenantWorkspace> = {};

  for (const row of SUPER_TENANT_ROWS) {
    const ws = emptyWorkspace();
    if (row.id === 't_demo') {
      ws.customers = JSON.parse(JSON.stringify(DEMO_CUSTOMERS)) as JsonRecord[];
      ws.qaDialogues = JSON.parse(JSON.stringify(DEMO_QA_DIALOGUES)) as JsonRecord[];
      ws.billing = buildBillingFromPlan('trial', {
        messagesUsed: 120,
        audienceUsed: 450,
        validUntil: '2026-05-10',
        invoices: [],
      });
    }
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
