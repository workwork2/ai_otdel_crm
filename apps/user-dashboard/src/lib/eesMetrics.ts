import type { CustomerProfile } from '@/types';

export interface EESDashboardMetrics {
  /** Главная цифра: выручка после касаний ИИ за календарный месяц */
  generatedRevenueMonthRub: number;
  /** Не выданные лишние скидки (оценка экономии) */
  savedMoneyRub: number;
  /** Клиенты из зоны риска, совершившие покупку после сценария удержания */
  churnRiskReturnedCount: number;
  /** Всего в зоне риска за период (для доли) */
  churnRiskContactedCount: number;
  clientsInBase: number;
}

/**
 * Агрегаты EES (Effectiveness / единая экономика сценариев) по текущей базе.
 * В проде часть полей приходит с бэкенда; здесь — детерминированно от профилей.
 */
export function computeEESMetrics(clients: CustomerProfile[]): EESDashboardMetrics {
  const enriched = clients;
  const generatedRevenueMonthRub = enriched.reduce(
    (s, c) => s + (c.attributedRevenue30d ?? 0),
    0
  );
  const savedMoneyRub = enriched.reduce((s, c) => s + (c.savedDiscountRub ?? 0), 0);

  const inRisk = enriched.filter(
    (c) =>
      c.scoring?.churnSegment === 'risk_zone' ||
      c.scoring?.churnSegment === 'recovery' ||
      c.ltvStatus === 'Высокий риск'
  );
  const churnRiskReturnedCount = enriched.filter(
    (c) =>
      c.scoring?.churnSegment === 'returned' || c.scoring?.lifecycle === 'reactivated'
  ).length;

  return {
    generatedRevenueMonthRub,
    savedMoneyRub,
    churnRiskReturnedCount,
    churnRiskContactedCount: Math.max(inRisk.length, churnRiskReturnedCount),
    clientsInBase: enriched.length,
  };
}

/** Точки для графика «удержание / возврат из зоны риска» (демо по неделям) */
export function churnPreventionTrend(): { week: string; returned: number; inRisk: number }[] {
  return [
    { week: 'Нед 1', returned: 12, inRisk: 48 },
    { week: 'Нед 2', returned: 18, inRisk: 52 },
    { week: 'Нед 3', returned: 24, inRisk: 44 },
    { week: 'Нед 4', returned: 31, inRisk: 39 },
  ];
}

export function formatRub(n: number): string {
  if (n >= 1_000_000) return `₽ ${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1000) return `₽ ${(n / 1000).toFixed(1)}k`;
  return `₽ ${Math.round(n).toLocaleString('ru-RU')}`;
}
