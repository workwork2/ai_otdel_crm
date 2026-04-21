import type { TenantWorkspace } from '../store/store.types';
import type { PlanKey } from './plan-entitlements';
import { normalizePlanKey, planDocRow } from './plan-entitlements';

function defaultValidUntil(k: PlanKey): string {
  const d = new Date();
  if (k === 'trial') {
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  }
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

export function buildBillingFromPlan(
  planKey: string,
  prev?: Partial<TenantWorkspace['billing']>
): TenantWorkspace['billing'] {
  const k = normalizePlanKey(planKey);
  const doc = planDocRow(k);
  const limits = doc.limits as {
    messagesPerMonth?: number | null;
    audienceContacts?: number | null;
  };
  const msgLimit =
    limits.messagesPerMonth == null ? 1_000_000 : Math.max(1, limits.messagesPerMonth);
  const audLimit =
    limits.audienceContacts == null ? 1_000_000 : Math.max(1, limits.audienceContacts);
  const price =
    typeof doc.priceRubMonthly === 'number' && !Number.isNaN(doc.priceRubMonthly)
      ? doc.priceRubMonthly
      : 0;
  const vu =
    prev?.validUntil && String(prev.validUntil).length > 0
      ? prev.validUntil
      : defaultValidUntil(k);

  return {
    planKey: k,
    planLabel: doc.name,
    priceRubMonthly: price,
    validUntil: vu,
    messagesUsed: Math.min(prev?.messagesUsed ?? 0, msgLimit),
    messagesLimit: msgLimit,
    audienceUsed: Math.min(prev?.audienceUsed ?? 0, audLimit),
    audienceLimit: audLimit,
    invoices: Array.isArray(prev?.invoices) ? prev!.invoices! : [],
  };
}

/** Поджимает включённые сценарии под лимит тарифа (стабильное поведение на показе). */
export function clampAutomationsToEntitlements(
  automations: TenantWorkspace['automations'],
  maxActive: number
): TenantWorkspace['automations'] {
  const activeIdx: number[] = [];
  automations.forEach((a, i) => {
    if (a.status === 'active') activeIdx.push(i);
  });
  if (activeIdx.length <= maxActive) return automations;
  const toPause = activeIdx.slice(maxActive);
  return automations.map((a, i) =>
    toPause.includes(i) ? { ...a, status: 'paused' as const } : a
  );
}
