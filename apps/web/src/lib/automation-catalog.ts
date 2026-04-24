/**
 * Подбор сценариев под нишу: e-commerce ≠ салон красоты (нет «брошенной корзины» и т.п.).
 * Значение хранится в brain.businessVertical и на «Автоматизации», и в «Настройки ИИ».
 */

export type BusinessVertical =
  | 'mixed'
  | 'ecommerce'
  | 'services_booking'
  | 'beauty_personal'
  | 'b2b';

export const BUSINESS_VERTICAL_OPTIONS: {
  id: BusinessVertical;
  /** Короткое имя в списке и для памяти */
  label: string;
  /** Зачем этот пресет: 1–2 предложения */
  hint: string;
  /** Конкретные примеры бизнеса — «как у всех», чтобы быстро узнать себя */
  examples: string;
}[] = [
  {
    id: 'mixed',
    label: 'Смешанный бизнес — пока везде понемногу',
    hint: 'Показываем полный набор сценариев. Когда определитесь с нишей, переключите пресет — лишнее можно будет скрыть.',
    examples:
      'Сеть разного профиля, маркетплейс продавцов, холдинг с несколькими направлениями, старт без чёткого фокуса.',
  },
  {
    id: 'ecommerce',
    label: 'Розница и умный магазин (онлайн + офлайн)',
    hint: 'Корзина, заказы, доставка, самовывоз, программа лояльности в приложении — без «записи на слот» как у сервиса.',
    examples:
      'Интернет-магазин, маркетплейс, умная витрина, доставка еды, АЗС с бонусами и приложением, продуктовый у дома.',
  },
  {
    id: 'services_booking',
    label: 'Запись и визит: автосервис, клиника, мастер',
    hint: 'Слоты, напоминания о визите, повторная запись — без акцента на «брошенную корзину».',
    examples:
      'Автосервис и СТО, автосалон (сервис), шиномонтаж, клиника и стоматология, ремонт техники, юрист / бухгалтер по записи.',
  },
  {
    id: 'beauty_personal',
    label: 'Красота, здоровье, уход — личный сервис',
    hint: 'Повторные визиты, абонементы, сезонный уход — тон как у салона, не как у безликого ритейла.',
    examples: 'Салон и маникюр, барбершоп, косметология, SPA, фитнес-студия, массаж, персональный тренер.',
  },
  {
    id: 'b2b',
    label: 'Компании и опт: договоры, не «корзина»',
    hint: 'Длинный цикл сделки, счета, отсрочки, персональный менеджер — без сценариев чистого B2C-магазина.',
    examples: 'Оптовые поставки, производство под заказ, интеграторы, SaaS для бизнеса, дистрибуция.',
  },
];

/** Акцент для мини-иллюстрации ниши (бордер / градиент в UI). */
export const BUSINESS_VERTICAL_ACCENTS: Record<
  BusinessVertical,
  { border: string; gradient: string; iconBg: string }
> = {
  mixed: {
    border: 'border-violet-500/35',
    gradient: 'from-violet-600/20 via-transparent to-fuchsia-600/10',
    iconBg: 'bg-violet-500/15 text-violet-300',
  },
  ecommerce: {
    border: 'border-sky-500/35',
    gradient: 'from-sky-600/20 via-transparent to-cyan-600/10',
    iconBg: 'bg-sky-500/15 text-sky-300',
  },
  services_booking: {
    border: 'border-amber-500/35',
    gradient: 'from-amber-600/20 via-transparent to-orange-600/10',
    iconBg: 'bg-amber-500/15 text-amber-200',
  },
  beauty_personal: {
    border: 'border-pink-500/35',
    gradient: 'from-pink-600/20 via-transparent to-rose-600/10',
    iconBg: 'bg-pink-500/15 text-pink-300',
  },
  b2b: {
    border: 'border-emerald-500/35',
    gradient: 'from-emerald-600/20 via-transparent to-teal-600/10',
    iconBg: 'bg-emerald-500/15 text-emerald-300',
  },
};

export type AutomationIconKey =
  | 'reactivation'
  | 'nps'
  | 'loyalty_burn'
  | 'birthday'
  | 'abandoned_cart'
  | 'post_sale'
  | 'tier'
  | 'seasonal'
  | 'onboarding'
  | 'appointment'
  | 'winback';

export type AutomationRuleCatalogEntry = {
  id: string;
  icon: AutomationIconKey;
  /** Показывать и включать по умолчанию только для этих ниш (mixed = все карточки видны) */
  forVerticals: BusinessVertical[];
  name: string;
  desc: string;
  defaultStatus: 'active' | 'paused';
  tag?: string;
  nameByVertical?: Partial<Record<BusinessVertical, string>>;
  descByVertical?: Partial<Record<BusinessVertical, string>>;
};

export const AUTOMATION_RULE_CATALOG: AutomationRuleCatalogEntry[] = [
  {
    id: 'a1',
    icon: 'reactivation',
    forVerticals: ['mixed', 'ecommerce', 'services_booking', 'beauty_personal', 'b2b'],
    name: 'Реактивация: вернуть ушедших',
    desc: 'ИИ замечает, если клиент пропал дольше обычного, и пишет ненавязчивое сообщение с поводом вернуться.',
    defaultStatus: 'active',
    tag: 'Retention',
  },
  {
    id: 'a2',
    icon: 'nps',
    forVerticals: ['mixed', 'ecommerce', 'services_booking', 'beauty_personal', 'b2b'],
    name: 'NPS и отзывы',
    desc: 'Через несколько часов после покупки или визита ИИ спрашивает об удовлетворённости и собирает оценки.',
    defaultStatus: 'active',
    tag: 'Voice of customer',
  },
  {
    id: 'a3',
    icon: 'loyalty_burn',
    forVerticals: ['mixed', 'ecommerce', 'services_booking', 'beauty_personal', 'b2b'],
    name: 'Сгорание бонусов / кэшбека',
    desc: 'Напоминание, если баллы или бонусы скоро сгорят — с мягким призывом воспользоваться.',
    defaultStatus: 'active',
    tag: 'Loyalty',
    descByVertical: {
      beauty_personal:
        'Напоминание по бонусам или абонементу, если срок действия подходит к концу.',
      services_booking: 'Напоминание по накопленным бонусам или пакету услуг до окончания срока.',
    },
  },
  {
    id: 'a4',
    icon: 'birthday',
    forVerticals: ['mixed', 'ecommerce', 'services_booking', 'beauty_personal', 'b2b'],
    name: 'День рождения',
    desc: 'Поздравление в день рождения с персональным подарком или промокодом.',
    defaultStatus: 'paused',
    tag: 'CRM-триггер',
  },
  {
    id: 'a5',
    icon: 'abandoned_cart',
    forVerticals: ['mixed', 'ecommerce'],
    name: 'Брошенная корзина',
    desc: 'Через 2–4 часа после добавления товаров в корзину — мягкое напоминание со ссылкой на оформление.',
    defaultStatus: 'active',
    tag: 'E-com',
  },
  {
    id: 'a6',
    icon: 'post_sale',
    forVerticals: ['mixed', 'ecommerce', 'services_booking', 'beauty_personal'],
    name: 'Пост-продажа и допродажа',
    desc: 'После выдачи заказа — кросс-селл аксессуаров и расходников к купленному.',
    defaultStatus: 'active',
    tag: 'Up-sell',
    nameByVertical: {
      beauty_personal: 'После визита: следующий уход и доп. услуги',
      services_booking: 'После визита: повторная запись и сопутствующие услуги',
    },
    descByVertical: {
      ecommerce:
        'После заказа или визита в точку (включая самовывоз и АЗС с магазином) — расходники, допы к покупке или бонусы.',
      beauty_personal:
        'После процедуры — напоминание о следующем визите, уходе дома или дополнительной услуге (например, укрепление).',
      services_booking:
        'После приёма или ремонта — предложение ТО, следующего визита или связанной услуги.',
    },
  },
  {
    id: 'a7',
    icon: 'tier',
    forVerticals: ['mixed', 'ecommerce', 'services_booking', 'beauty_personal'],
    name: 'Программа лояльности',
    desc: 'Автоматическое повышение уровня, напоминание о привилегиях и дедлайнах статуса.',
    defaultStatus: 'active',
    tag: 'Tier',
  },
  {
    id: 'a8',
    icon: 'seasonal',
    forVerticals: ['mixed', 'ecommerce', 'services_booking', 'beauty_personal', 'b2b'],
    name: 'Возврат к сезонному спросу',
    desc: 'Триггер по категории и календарю: «сезон начался» — персональный оффер.',
    defaultStatus: 'paused',
    tag: 'Кампания',
    descByVertical: {
      beauty_personal: 'Сезонные процедуры и уход (лето/зима) — персональное напоминание и оффер.',
      b2b: 'Сезон закупок или отчётности — мягкое касание без давления.',
    },
  },
  {
    id: 'a9',
    icon: 'onboarding',
    forVerticals: ['mixed', 'ecommerce', 'services_booking', 'beauty_personal', 'b2b'],
    name: 'Онбординг нового клиента',
    desc: 'Цепочка из нескольких сообщений: как пользоваться бонусами, доставкой или записью и поддержкой.',
    defaultStatus: 'active',
    tag: 'Welcome',
    descByVertical: {
      beauty_personal: 'Знакомство с салоном: бонусы, запись онлайн, политика переноса визита.',
      b2b: 'Знакомство с процессом: контакты менеджера, оплата, типовые шаги после старта.',
    },
  },
  {
    id: 'a10',
    icon: 'appointment',
    forVerticals: ['mixed', 'ecommerce', 'services_booking', 'beauty_personal'],
    name: 'Напоминание о записи / визите',
    desc: 'За 24 ч и за 2 ч до слота — подтверждение и возможность переноса в один тап.',
    defaultStatus: 'active',
    tag: 'Сервис',
    descByVertical: {
      ecommerce:
        'Для доставки или самовывоза: окно времени и контакт курьера; для записи в шоурум — то же, что у сервиса.',
    },
  },
  {
    id: 'a11',
    icon: 'winback',
    forVerticals: ['mixed', 'ecommerce', 'services_booking', 'beauty_personal', 'b2b'],
    name: 'Win-back после отписки',
    desc: 'Если клиент отключил рассылку — одно нейтральное письмо с опросом причины и бонусом за возврат.',
    defaultStatus: 'paused',
    tag: 'Churn',
  },
];

export function parseBusinessVertical(raw: unknown): BusinessVertical {
  const v = String(raw ?? '').trim();
  if (
    v === 'ecommerce' ||
    v === 'services_booking' ||
    v === 'beauty_personal' ||
    v === 'b2b' ||
    v === 'mixed'
  ) {
    return v;
  }
  return 'mixed';
}

export function catalogEntryVisibleForVertical(
  entry: AutomationRuleCatalogEntry,
  vertical: BusinessVertical
): boolean {
  if (vertical === 'mixed') return true;
  return entry.forVerticals.includes(vertical);
}

export type AutomationRowForReconcile = {
  id: string;
  name: string;
  desc: string;
  tag?: string;
  status: 'active' | 'paused';
};

/** canonicalName — ключ в API; display* — только для карточки */
export function pickAutomationCopy(
  entry: AutomationRuleCatalogEntry,
  vertical: BusinessVertical
): { canonicalName: string; displayName: string; displayDesc: string } {
  return {
    canonicalName: entry.name,
    displayName: entry.nameByVertical?.[vertical] ?? entry.name,
    displayDesc: entry.descByVertical?.[vertical] ?? entry.desc,
  };
}

/** Для ниши «не mixed» переводим нерелевантные сценарии в paused (имя в API = canonical). */
export function reconcileAutomationsForVertical(
  rows: AutomationRowForReconcile[],
  vertical: BusinessVertical
): AutomationRowForReconcile[] {
  if (vertical === 'mixed') return rows;
  const byCatalogName = new Map(AUTOMATION_RULE_CATALOG.map((e) => [e.name, e]));
  return rows.map((row) => {
    const entry = byCatalogName.get(row.name);
    if (!entry) return row;
    if (!catalogEntryVisibleForVertical(entry, vertical) && row.status === 'active') {
      return { ...row, status: 'paused' as const };
    }
    return row;
  });
}

export function automationsNeedReconcile(
  rows: AutomationRowForReconcile[],
  vertical: BusinessVertical
): boolean {
  if (vertical === 'mixed') return false;
  const next = reconcileAutomationsForVertical(rows, vertical);
  return next.some((r, i) => r.status !== rows[i]?.status);
}
