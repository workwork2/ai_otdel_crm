import type { JsonRecord, TenantWorkspace } from '../store/store.types';

/** Сжатое описание базы и QA для промпта ИИ-отчёта (без PII в сыром виде — только агрегаты и выжимки). */
export function buildAnalyticsDigestForPrompt(w: TenantWorkspace): string {
  const customers = w.customers ?? [];
  const n = customers.length;
  let churnHigh = 0;
  let churnMed = 0;
  let churnLow = 0;
  let totalPurchases = 0;
  let purchaseSum = 0;
  const lifecycleBuckets: Record<string, number> = {};
  const types: Record<string, number> = {};

  for (const c of customers) {
    const row = c as JsonRecord;
    const loyalty = row.loyalty as JsonRecord | undefined;
    const scoring = row.scoring as JsonRecord | undefined;
    const churn = String(loyalty?.churnRisk ?? '').toLowerCase();
    if (churn.includes('высок')) churnHigh += 1;
    else if (churn.includes('средн')) churnMed += 1;
    else if (churn.includes('низк') || churn.includes('низкий')) churnLow += 1;
    const life = String(scoring?.lifecycle ?? '').trim();
    if (life) lifecycleBuckets[life] = (lifecycleBuckets[life] ?? 0) + 1;
    const t = String(row?.type ?? 'unknown');
    types[t] = (types[t] ?? 0) + 1;
    const purchases = row?.purchases;
    if (Array.isArray(purchases)) {
      for (const p of purchases) {
        totalPurchases += 1;
        purchaseSum += Number((p as JsonRecord)?.price ?? 0);
      }
    }
  }

  const qa = w.qaDialogues ?? [];
  const qaSample = qa.slice(-5).map((d, i) => {
    const dr = d as JsonRecord;
    const msgs = dr?.messages;
    const last =
      Array.isArray(msgs) && msgs.length
        ? String((msgs[msgs.length - 1] as JsonRecord)?.text ?? '').slice(0, 120)
        : '';
    return `  ${i + 1}. ${last || '(без текста)'}`;
  });

  const lines = [
    `Клиентов в базе: ${n}`,
    `Покупок (записей): ${totalPurchases}, сумма price по полям: ${Math.round(purchaseSum)} ₽ (если в данных есть цены)`,
    `Churn (эвристика по loyalty.churnRisk): высокий ${churnHigh}, средний ${churnMed}, низкий/прочее ${churnLow}`,
    `Типы клиентов: ${JSON.stringify(types)}`,
    `Lifecycle (scoring.lifecycle): ${JSON.stringify(lifecycleBuckets)}`,
    `Диалогов QA: ${qa.length}`,
    qa.length ? `Последние темы/фразы QA:\n${qaSample.join('\n')}` : 'QA: пусто',
  ];
  return lines.join('\n');
}
