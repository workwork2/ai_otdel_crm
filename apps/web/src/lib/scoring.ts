import type { ClientScoring, CustomerProfile, LifecycleStage, ChurnSegment } from '@/types';

function daysBetween(isoA: string, isoB: string): number {
  const a = new Date(isoA).getTime();
  const b = new Date(isoB).getTime();
  return Math.max(0, Math.round((b - a) / (24 * 60 * 60 * 1000)));
}

/** Последняя дата покупки из чеков */
export function getLastPurchaseDate(c: CustomerProfile): string | null {
  if (!c.purchases.length) return null;
  const sorted = [...c.purchases].sort(
    (x, y) => new Date(y.date).getTime() - new Date(x.date).getTime()
  );
  return sorted[0]?.date ?? null;
}

function riskFromLoyalty(churn: CustomerProfile['loyalty']['churnRisk']): number {
  if (churn === 'Высокий') return 82;
  if (churn === 'Средний') return 48;
  return 22;
}

function pickLifecycle(days: number, ltv: CustomerProfile['ltvStatus']): LifecycleStage {
  if (ltv === 'Высокий риск') return 'at_risk';
  if (days > 120) return 'dormant';
  if (days > 60) return 'dormant';
  if (days > 30 || ltv === 'Основа') return 'active';
  if (days <= 14) return 'new';
  return 'active';
}

function pickChurnSegment(
  riskIdx: number,
  lifecycle: LifecycleStage,
  ltv: CustomerProfile['ltvStatus']
): ChurnSegment {
  if (ltv === 'Высокий риск' || lifecycle === 'at_risk') {
    if (riskIdx >= 70) return 'risk_zone';
    return 'recovery';
  }
  if (lifecycle === 'dormant' && riskIdx >= 55) return 'risk_zone';
  if (lifecycle === 'dormant') return 'watch';
  if (riskIdx >= 65) return 'watch';
  if (lifecycle === 'reactivated') return 'returned';
  return 'stable';
}

function priorityFrom(riskIdx: number, clv: number, type: CustomerProfile['type']): number {
  const base = 100 - Math.round(riskIdx * 0.45);
  const clvBoost = Math.min(18, Math.round(clv / 200000));
  const b2b = type === 'b2b' ? 8 : 0;
  return Math.max(5, Math.min(100, base + clvBoost + b2b));
}

/**
 * Полная модель скоринга для CRM: приоритет ИИ, зона оттока, жизненный цикл.
 */
export function deriveScoring(c: CustomerProfile): ClientScoring {
  const last = getLastPurchaseDate(c);
  const today = new Date().toISOString().slice(0, 10);
  const daysSince = last ? daysBetween(last, today) : 999;

  let riskIndex = riskFromLoyalty(c.loyalty.churnRisk);
  if (daysSince > 90) riskIndex = Math.min(100, riskIndex + 12);
  if (daysSince > 180) riskIndex = Math.min(100, riskIndex + 10);
  if (c.ltvStatus === 'VIP') riskIndex = Math.max(5, riskIndex - 15);

  const lifecycle = pickLifecycle(daysSince, c.ltvStatus);
  const churnSegment = pickChurnSegment(riskIndex, lifecycle, c.ltvStatus);
  const priorityScore = priorityFrom(riskIndex, c.loyalty.aiPredictedCLV, c.type);

  return {
    lifecycle,
    churnSegment,
    priorityScore,
    riskIndex,
    daysSincePurchase: last ? daysSince : 999,
  };
}

export function sumAttributedFromHistory(c: CustomerProfile): number {
  return c.history.reduce((acc, e) => acc + (e.revenueImpact ?? 0), 0);
}

/** Добавляет scoring и при необходимости денежные поля из истории */
export function enrichCustomer(c: CustomerProfile): CustomerProfile {
  const scoring = c.scoring ?? deriveScoring(c);
  const fromHistory = sumAttributedFromHistory(c);
  const attributedRevenue30d =
    c.attributedRevenue30d ?? (fromHistory > 0 ? fromHistory : undefined);
  const savedDiscountRub =
    c.savedDiscountRub ??
    (scoring.churnSegment === 'risk_zone' || scoring.churnSegment === 'watch'
      ? Math.round(scoring.priorityScore * 40 + c.loyalty.pointsBalance * 0.5)
      : Math.round(120 + scoring.riskIndex * 3));

  return {
    ...c,
    scoring,
    attributedRevenue30d: attributedRevenue30d ?? 0,
    savedDiscountRub,
  };
}

export const CHURN_LABEL: Record<ChurnSegment, string> = {
  stable: 'Стабильный',
  watch: 'Наблюдение',
  risk_zone: 'Зона риска',
  recovery: 'В работе ИИ',
  returned: 'Вернулся',
};

export const LIFECYCLE_LABEL: Record<LifecycleStage, string> = {
  new: 'Новый',
  active: 'Активный',
  dormant: 'Сонный',
  at_risk: 'Под угрозой',
  reactivated: 'Реактивация',
};
