import type { CustomerProfile, DiscountRule, PromotionItem } from '@/types';
import { enrichCustomer } from '@/lib/scoring';
import rawSeed from '@/fixtures/outreach-plan-demo.seed.json';

type DemoSlot = {
  id: string;
  customerId: string;
  email: string;
  customerName: string;
  scheduledAt: string;
  subject: string;
  bodyText: string;
  status: 'pending' | 'sent' | 'failed' | 'skipped_limit';
  lastError?: string;
  personalizedByAi: boolean;
};

export type DemoOutreachCampaignSeed = {
  version: 1;
  status: 'draft' | 'running' | 'paused' | 'completed';
  target: 'retention' | 'marketing';
  planText: string;
  baseSubject: string;
  baseBodyText: string;
  recipientIds: string[];
  updatedAt: number;
  slots: DemoSlot[];
};

export const LS_OUTREACH_DEMO = 'linearize-outreach-demo';

/** Активируется через `?demo=1` в URL или localStorage `linearize-outreach-demo=1` */
export function readOutreachDemoFlag(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(LS_OUTREACH_DEMO) === '1';
  } catch {
    return false;
  }
}

export function setOutreachDemoFlag(on: boolean) {
  if (typeof window === 'undefined') return;
  try {
    if (on) localStorage.setItem(LS_OUTREACH_DEMO, '1');
    else localStorage.removeItem(LS_OUTREACH_DEMO);
  } catch {
    /* ignore */
  }
}

/** Сдвигаем слоты от «сейчас», чтобы окно плана всегда выглядело актуально */
export function hydrateOutreachDemoCampaign(): DemoOutreachCampaignSeed {
  const base = rawSeed as DemoOutreachCampaignSeed;
  const t0 = Date.now();
  const hourMs = 3600_000;
  return {
    ...base,
    updatedAt: t0,
    slots: base.slots.map((s, i) => ({
      ...s,
      scheduledAt: new Date(t0 + (i + 1) * 5 * hourMs + (i % 3) * 15 * 60_000).toISOString(),
    })),
  };
}

const demoLoyalty = (churn: CustomerProfile['loyalty']['churnRisk']): CustomerProfile['loyalty'] => ({
  tier: 'Серебро',
  pointsBalance: 420,
  aiPredictedCLV: 18500,
  churnRisk: churn,
  nextAction: 'Персональное письмо',
});

/** Клиенты для превью «Рассылка»: согласие, валидный email, скоринг после enrich — чтобы счётчики и отбор совпадали с демо-матрицей. */
const OUTREACH_DEMO_CLIENTS_RAW: CustomerProfile[] = [
  {
    id: 'demo-c-1',
    name: 'Анна Волкова',
    avatar: '',
    phone: '+7 900 100-01-01',
    email: 'anna.volkhova@example.com',
    type: 'b2c',
    ltvStatus: 'Высокий риск',
    loyalty: demoLoyalty('Высокий'),
    purchases: [{ id: 'p1', title: 'Заказ', date: '2024-08-12', price: 3200, category: 'Общее' }],
    history: [],
    consent: { marketing: true, whatsapp: false, telegram: false },
  },
  {
    id: 'demo-c-2',
    name: 'Борис Ким',
    avatar: '',
    phone: '+7 900 100-02-02',
    email: 'boris.k@example.com',
    type: 'b2c',
    ltvStatus: 'Основа',
    loyalty: demoLoyalty('Средний'),
    purchases: [{ id: 'p2', title: 'Заказ', date: '2024-11-01', price: 5100, category: 'Общее' }],
    history: [],
    consent: { marketing: true, whatsapp: true, telegram: false },
  },
  {
    id: 'demo-c-3',
    name: 'Елена Морозова',
    avatar: '',
    phone: '+7 900 100-03-03',
    email: 'elena.m@example.com',
    type: 'b2c',
    ltvStatus: 'Высокий риск',
    loyalty: demoLoyalty('Высокий'),
    purchases: [{ id: 'p3', title: 'Заказ', date: '2024-05-20', price: 8900, category: 'Общее' }],
    history: [],
    consent: { marketing: true, whatsapp: false, telegram: false },
  },
  {
    id: 'demo-c-4',
    name: 'Дмитрий Соколов',
    avatar: '',
    phone: '+7 900 100-04-04',
    email: 'dmitry.sokolov@example.com',
    type: 'b2c',
    ltvStatus: 'Основа',
    loyalty: demoLoyalty('Средний'),
    purchases: [{ id: 'p4', title: 'Заказ', date: '2025-01-10', price: 1200, category: 'Общее' }],
    history: [],
    consent: { marketing: true, whatsapp: false, telegram: false },
  },
  {
    id: 'demo-c-5',
    name: 'Марина Павлова',
    avatar: '',
    phone: '+7 900 100-05-05',
    email: 'marina.p@example.com',
    type: 'b2c',
    ltvStatus: 'Лояльный',
    loyalty: demoLoyalty('Низкий'),
    purchases: [{ id: 'p5', title: 'Заказ', date: '2025-03-01', price: 6700, category: 'Общее' }],
    history: [],
    consent: { marketing: true, whatsapp: false, telegram: false },
  },
  {
    id: 'demo-c-6',
    name: 'Игорь Новиков',
    avatar: '',
    phone: '+7 900 100-06-06',
    email: 'igor.n@example.com',
    type: 'b2c',
    ltvStatus: 'Основа',
    loyalty: demoLoyalty('Средний'),
    purchases: [{ id: 'p6', title: 'Заказ', date: '2024-12-15', price: 2100, category: 'Общее' }],
    history: [],
    consent: { marketing: true, whatsapp: false, telegram: false },
  },
  {
    id: 'demo-c-7',
    name: 'Светлана Лебедева',
    avatar: '',
    phone: '+7 900 100-07-07',
    email: 'svetlana.l@example.com',
    type: 'b2c',
    ltvStatus: 'Высокий риск',
    loyalty: demoLoyalty('Высокий'),
    purchases: [{ id: 'p7', title: 'Заказ', date: '2024-04-02', price: 4500, category: 'Общее' }],
    history: [],
    consent: { marketing: true, whatsapp: false, telegram: false },
  },
  {
    id: 'demo-c-8',
    name: 'Олег Васильев',
    avatar: '',
    phone: '+7 900 100-08-08',
    email: 'oleg.v@example.com',
    type: 'b2c',
    ltvStatus: 'Лояльный',
    loyalty: demoLoyalty('Низкий'),
    purchases: [{ id: 'p8', title: 'Заказ', date: '2025-02-28', price: 990, category: 'Общее' }],
    history: [],
    consent: { marketing: true, whatsapp: false, telegram: false },
  },
  {
    id: 'demo-c-9',
    name: 'Кирилл Орлов',
    avatar: '',
    phone: '+7 900 100-09-09',
    email: 'kirill.o@example.com',
    type: 'b2c',
    ltvStatus: 'Основа',
    loyalty: demoLoyalty('Средний'),
    purchases: [{ id: 'p9', title: 'Заказ', date: '2024-10-10', price: 3300, category: 'Общее' }],
    history: [],
    consent: { marketing: true, whatsapp: false, telegram: false },
  },
  {
    id: 'demo-c-10',
    name: 'Наталья Зайцева',
    avatar: '',
    phone: '+7 900 100-10-10',
    email: 'natalia.z@example.com',
    type: 'b2c',
    ltvStatus: 'VIP',
    loyalty: demoLoyalty('Низкий'),
    purchases: [{ id: 'p10', title: 'Заказ', date: '2025-03-20', price: 24000, category: 'Общее' }],
    history: [],
    consent: { marketing: true, whatsapp: false, telegram: false },
  },
  {
    id: 'demo-c-11',
    name: 'Павел Фёдоров',
    avatar: '',
    phone: '+7 900 100-11-11',
    email: 'pavel.f@example.com',
    type: 'b2c',
    ltvStatus: 'Высокий риск',
    loyalty: demoLoyalty('Высокий'),
    purchases: [{ id: 'p11', title: 'Заказ', date: '2023-12-01', price: 1800, category: 'Общее' }],
    history: [],
    consent: { marketing: true, whatsapp: false, telegram: false },
  },
  {
    id: 'demo-c-12',
    name: 'Ольга Смирнова',
    avatar: '',
    phone: '+7 900 100-12-12',
    email: 'olga.smirnova@example.com',
    type: 'b2c',
    ltvStatus: 'Основа',
    loyalty: demoLoyalty('Средний'),
    purchases: [{ id: 'p12', title: 'Заказ', date: '2025-01-22', price: 4100, category: 'Общее' }],
    history: [],
    consent: { marketing: true, whatsapp: true, telegram: false },
  },
];

let outreachDemoClientsCache: CustomerProfile[] | null = null;

export function getOutreachDemoClients(): CustomerProfile[] {
  if (!outreachDemoClientsCache) {
    outreachDemoClientsCache = OUTREACH_DEMO_CLIENTS_RAW.map((c) => enrichCustomer(c));
  }
  return outreachDemoClientsCache;
}

/**
 * Пересборка демо-плана на фронтенде (без API и без ИИ): тема/тело из «Настройки ИИ», слоты и время — из сида.
 */
export function buildLocalOutreachPlanFromLetter(opts: {
  baseSubject: string;
  baseBodyText: string;
  launchLimit: number;
}): DemoOutreachCampaignSeed {
  const hydrated = hydrateOutreachDemoCampaign();
  const cap = Math.min(500, Math.max(1, Math.floor(opts.launchLimit)));
  const maxSlots = hydrated.slots.length;
  const n = Math.min(maxSlots, cap);
  const t0 = Date.now();
  const hourMs = 3600_000;
  const slots = hydrated.slots.slice(0, n).map((s, i) => ({
    ...s,
    scheduledAt: new Date(t0 + (i + 1) * 5 * hourMs + (i % 3) * 15 * 60_000).toISOString(),
  }));
  const recipientIds = Array.from(new Set(slots.map((s) => s.customerId)));
  const subj = opts.baseSubject.trim() || hydrated.baseSubject;
  const body = opts.baseBodyText.trim() || hydrated.baseBodyText;
  const planTop = [
    '## Локальный черновик (без ИИ)',
    '',
    `Собрано в браузере для превью. В матрице **${n}** строк — не больше числа в «Лимит запуска» и не больше **${maxSlots}** демо-контактов в сиде.`,
    '',
  ].join('\n');
  return {
    ...hydrated,
    planText: planTop + hydrated.planText,
    baseSubject: subj,
    baseBodyText: body,
    recipientIds,
    slots,
    updatedAt: t0,
  };
}

export const DEMO_MESSAGES_QUOTA = { used: 124, limit: 2000 } as const;

export const DEMO_PROMO_FALLBACK: PromotionItem = {
  id: 'demo-promo',
  title: 'Весенняя распродажа',
  body: 'Скидки на избранные категории до конца месяца.',
  validUntil: '2026-05-31',
  active: true,
};

export const DEMO_DISCOUNT_FALLBACK: DiscountRule = {
  id: 'demo-disc',
  code: 'RETURN15',
  percent: 15,
  description: 'Персональный промокод на возврат клиента',
  active: true,
};
