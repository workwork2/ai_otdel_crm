import type { CustomerProfile, LoyaltyData } from '@/types';

/** Сигналы из произвольной строки Excel для автоматического присвоения статуса и риска */
export interface ImportSignals {
  /** Оценка дней без активности / покупки */
  daysIdle?: number;
  /** Сумма покупок / выручка / CLV из таблицы */
  spendRub?: number;
  /** Произвольный текст уровня (VIP, серебро…) */
  tierText?: string;
  /** Любой текст про риск из ячеек */
  riskText?: string;
  /** Явно B2B */
  isB2B?: boolean;
}

function norm(s: string): string {
  return s.trim().toLowerCase();
}

function mapTier(tierText: string | undefined): LoyaltyData['tier'] {
  const x = norm(tierText ?? '');
  if (!x) return 'Бронза';
  if (x.includes('vip') || x.includes('вип') || x.includes('платин')) return 'VIP';
  if (x.includes('золот') || x.includes('gold')) return 'Золото';
  if (x.includes('серебр') || x.includes('silver')) return 'Серебро';
  return 'Бронза';
}

/**
 * Итоговый риск оттока и LTV-статус считаются системой, а не копируются слепо из файла.
 * Колонки «риск»/комментарии только подкручивают оценку.
 */
export function loyaltyFromImportSignals(s: ImportSignals): {
  loyalty: LoyaltyData;
  ltvStatus: CustomerProfile['ltvStatus'];
  explain: string;
} {
  const tier = mapTier(s.tierText);
  const days = s.daysIdle ?? 45;
  const spend = s.spendRub ?? 50000;
  const riskN = norm(s.riskText ?? '');

  let churnRisk: LoyaltyData['churnRisk'] = 'Средний';
  if (days >= 100 || riskN.includes('высок') || riskN.includes('high') || riskN.includes('отток')) {
    churnRisk = 'Высокий';
  } else if (days <= 30 && spend >= 80000 && !riskN.includes('высок')) {
    churnRisk = 'Низкий';
  } else if (days <= 45 && !riskN.match(/высок|сред/i)) {
    churnRisk = 'Низкий';
  }

  if (riskN.includes('низк') || riskN.includes('low')) {
    churnRisk = 'Низкий';
  }
  if (riskN.includes('сред') && !riskN.includes('высок')) {
    churnRisk = 'Средний';
  }

  let ltvStatus: CustomerProfile['ltvStatus'] = 'Основа';
  if (tier === 'VIP' || spend > 500000) ltvStatus = 'VIP';
  else if (churnRisk === 'Высокий' && days > 60) ltvStatus = 'Высокий риск';
  else if (spend > 200000 && churnRisk !== 'Высокий') ltvStatus = 'Лояльный';

  const pointsBalance = Math.min(500000, Math.round(Math.sqrt(Math.max(spend, 1)) * 3));
  const aiPredictedCLV = Math.max(spend * 1.2, 25000);

  const loyalty: LoyaltyData = {
    tier,
    pointsBalance,
    aiPredictedCLV,
    churnRisk,
    nextAction: 'Автоназначение после импорта: сегмент и сценарий подберёт EES.',
  };

  const explain = `Дни без активности (оценка): ${days}. Сумма/CLV из файла: ${Math.round(spend)} ₽. Уровень: ${tier}. Риск оттока: ${churnRisk} (правила + подсказки из ячеек).`;

  return { loyalty, ltvStatus, explain };
}
