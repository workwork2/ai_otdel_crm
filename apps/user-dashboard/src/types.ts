export interface CommunicationEvent {
  id: string;
  date: string;
  type: 'sms' | 'whatsapp' | 'telegram' | 'system' | 'email';
  content: string;
  sender: 'ai' | 'client' | 'system';
  status: 'sent' | 'delivered' | 'read' | 'failed' | 'processed';
  revenueImpact?: number;
}

export interface PurchaseItem {
  id: string;
  title: string;
  date: string;
  price: number;
  category: string;
}

export interface LoyaltyData {
  tier: 'Бронза' | 'Серебро' | 'Золото' | 'VIP';
  pointsBalance: number;
  aiPredictedCLV: number;
  churnRisk: 'Низкий' | 'Средний' | 'Высокий';
  nextAction: string;
}

/** Жизненный цикл клиента в CRM */
export type LifecycleStage = 'new' | 'active' | 'dormant' | 'at_risk' | 'reactivated';

/**
 * Сегмент по оттоку: зона риска → работа ИИ → возврат.
 * `returned` — подтверждённый возврат после касания в зоне риска.
 */
export type ChurnSegment = 'stable' | 'watch' | 'risk_zone' | 'recovery' | 'returned';

/** Скоринг и приоритет для очереди ИИ (EES) */
export interface ClientScoring {
  lifecycle: LifecycleStage;
  churnSegment: ChurnSegment;
  /** 0–100: приоритет в очереди касаний ИИ */
  priorityScore: number;
  /** 0–100: индекс риска оттока (выше — опаснее) */
  riskIndex: number;
  /** Дней с последней покупки (оценка по датам чеков) */
  daysSincePurchase: number;
}

export interface CustomerProfile {
  id: string;
  name: string;
  avatar: string;
  phone: string;
  email: string;
  type: 'b2c' | 'b2b';
  ltvStatus: 'Высокий риск' | 'Основа' | 'Лояльный' | 'VIP';
  loyalty: LoyaltyData;
  purchases: PurchaseItem[];
  history: CommunicationEvent[];
  consent: {
    marketing: boolean;
    whatsapp: boolean;
    telegram: boolean;
  };
  /** Если нет — вычисляется при загрузке (enrich) */
  scoring?: ClientScoring;
  /**
   * Выручка за последние 30 дней, атрибутированная покупкам после касания ИИ (руб).
   * В проде — из BI/сквозной аналитики.
   */
  attributedRevenue30d?: number;
  /**
   * Оценка «спасённых денег»: не выданная скидка тем, кто купил бы без неё (руб/мес).
   */
  savedDiscountRub?: number;
}

/** Каналы в мониторинге диалогов ИИ */
export type QAChannel = 'whatsapp' | 'telegram' | 'sms' | 'email';

/** Статус треда в очереди контроля качества */
export type QADialogueStatus = 'warning' | 'intercepted' | 'success' | 'active';

export interface QADialogueMessage {
  id: string;
  date: string;
  sender: 'ai' | 'client' | 'system' | 'manager';
  content: string;
}

export interface QADialogue {
  id: string;
  client: string;
  clientInitials: string;
  channel: QAChannel;
  status: QADialogueStatus;
  issue: string;
  managerNote?: string;
  updatedAt: string;
  messages: QADialogueMessage[];
}

/** Правило скидки / промокод для настроек ИИ */
export interface DiscountRule {
  id: string;
  code: string;
  percent: number;
  description: string;
  active: boolean;
}

/** Маркетинговая акция в знании ИИ */
export interface PromotionItem {
  id: string;
  title: string;
  body: string;
  validUntil: string;
  active: boolean;
}
