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
 * Агрегаты EES по текущей базе клиентов (только поля из профилей).
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

/**
 * Точки для графика удержания — только агрегаты по текущей базе (без выдуманных недель).
 */
export function churnTrendFromClients(clients: CustomerProfile[]): {
  week: string;
  returned: number;
  inRisk: number;
}[] {
  if (clients.length === 0) return [];
  const ees = computeEESMetrics(clients);
  return [
    {
      week: 'По базе',
      returned: ees.churnRiskReturnedCount,
      inRisk: ees.churnRiskContactedCount,
    },
  ];
}

const LIFECYCLE_LABEL: Record<string, string> = {
  new: 'Новые',
  active: 'Активные',
  dormant: 'Спящие',
  at_risk: 'В зоне риска',
  reactivated: 'Реактивированные',
};

/** Воронка по lifecycle из скоринга (только клиенты с заполненным scoring). */
export function lifecycleFunnelFromClients(clients: CustomerProfile[]): { name: string; value: number }[] {
  if (!clients.length) return [];
  const counts = new Map<string, number>();
  for (const c of clients) {
    const lc = c.scoring?.lifecycle;
    if (!lc) continue;
    counts.set(lc, (counts.get(lc) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ name: LIFECYCLE_LABEL[k] ?? k, value: v }));
}

/** Суммы покупок по месяцам из purchases[].date (только данные базы). */
export function purchaseTotalsByMonth(
  clients: CustomerProfile[],
  monthsBack = 8
): { key: string; name: string; value: number }[] {
  const now = new Date();
  const rows: { key: string; name: string; value: number }[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const name = d.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' });
    rows.push({ key, name, value: 0 });
  }
  const keySet = new Set(rows.map((r) => r.key));
  for (const c of clients) {
    for (const p of c.purchases ?? []) {
      const pd = new Date(p.date);
      if (Number.isNaN(pd.getTime())) continue;
      const key = `${pd.getFullYear()}-${String(pd.getMonth() + 1).padStart(2, '0')}`;
      if (!keySet.has(key)) continue;
      const row = rows.find((r) => r.key === key);
      if (row) row.value += p.price;
    }
  }
  return rows;
}

export function formatRub(n: number): string {
  if (n >= 1_000_000) return `₽ ${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1000) return `₽ ${(n / 1000).toFixed(1)}k`;
  return `₽ ${Math.round(n).toLocaleString('ru-RU')}`;
}
