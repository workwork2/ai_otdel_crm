/** Даты подписки хранятся как YYYY-MM-DD (локальный календарный день). */

export function parseDateOnlyLocal(isoDate: string): Date {
  const s = String(isoDate).slice(0, 10);
  const [y, m, d] = s.split('-').map((x) => Number(x));
  if (!y || !m || !d) return new Date(NaN);
  return new Date(y, m - 1, d);
}

export function subscriptionWindowFromValidUntil(validUntil: string): {
  isExpired: boolean;
  daysRemaining: number;
} {
  const end = parseDateOnlyLocal(validUntil);
  if (Number.isNaN(end.getTime())) {
    return { isExpired: false, daysRemaining: 365 };
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const diffMs = end.getTime() - today.getTime();
  const daysRemaining = Math.ceil(diffMs / 86400000);
  if (daysRemaining < 0) return { isExpired: true, daysRemaining: 0 };
  return { isExpired: false, daysRemaining };
}

/** Продление от max(сегодня, текущий validUntil) + days. */
export function extendValidUntilByDays(currentValidUntil: string, days: number): string {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  let base = parseDateOnlyLocal(currentValidUntil);
  if (Number.isNaN(base.getTime())) base = new Date(now);
  base.setHours(0, 0, 0, 0);
  if (base < now) base = new Date(now);
  base.setDate(base.getDate() + days);
  const y = base.getFullYear();
  const mo = String(base.getMonth() + 1).padStart(2, '0');
  const da = String(base.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}
