import { SUBSCRIPTION_PLANS_DOC } from '../store/seed/super.seed';

export type PlanKey = 'trial' | 'starter' | 'pro' | 'business_plus' | 'enterprise';

/** Возможности тарифа — фронт скрывает/блокирует функции при отсутствии флага. */
export interface PlanEntitlements {
  /** Максимум одновременно включённых сценариев (автоматизаций). */
  maxActiveAutomations: number;
  excelImport: boolean;
  /** Перехват диалога, ответ менеджера в QA. */
  qaFullAccess: boolean;
  /** Расширенные отчёты, воронка, экспорт. */
  analyticsAdvanced: boolean;
  /** Кнопки «доработать текст» через ИИ. */
  aiRefineCopy: boolean;
  /** Подключение новых интеграций (не только просмотр). */
  integrationsManage: boolean;
  /** Канал MAX (VK) и расширенные мессенджеры. */
  maxChannel: boolean;
  exportReports: boolean;
}

export const PLAN_ENTITLEMENTS: Record<PlanKey, PlanEntitlements> = {
  trial: {
    maxActiveAutomations: 3,
    excelImport: false,
    qaFullAccess: false,
    analyticsAdvanced: false,
    aiRefineCopy: false,
    integrationsManage: false,
    maxChannel: false,
    exportReports: false,
  },
  starter: {
    maxActiveAutomations: 6,
    excelImport: true,
    qaFullAccess: true,
    analyticsAdvanced: false,
    aiRefineCopy: true,
    integrationsManage: true,
    maxChannel: false,
    exportReports: true,
  },
  business_plus: {
    maxActiveAutomations: 12,
    excelImport: true,
    qaFullAccess: true,
    analyticsAdvanced: true,
    aiRefineCopy: true,
    integrationsManage: true,
    maxChannel: false,
    exportReports: true,
  },
  pro: {
    maxActiveAutomations: 50,
    excelImport: true,
    qaFullAccess: true,
    analyticsAdvanced: true,
    aiRefineCopy: true,
    integrationsManage: true,
    maxChannel: true,
    exportReports: true,
  },
  enterprise: {
    maxActiveAutomations: 9999,
    excelImport: true,
    qaFullAccess: true,
    analyticsAdvanced: true,
    aiRefineCopy: true,
    integrationsManage: true,
    maxChannel: true,
    exportReports: true,
  },
};

const ALIASES: Record<string, PlanKey> = {
  trial: 'trial',
  starter: 'starter',
  pro: 'pro',
  business_plus: 'business_plus',
  enterprise: 'enterprise',
};

export function normalizePlanKey(raw: string): PlanKey {
  const k = raw?.trim().toLowerCase();
  if (k && k in ALIASES) return ALIASES[k]!;
  return 'starter';
}

export function entitlementsForPlan(planKey: string): PlanEntitlements {
  const k = normalizePlanKey(planKey);
  return PLAN_ENTITLEMENTS[k] ?? PLAN_ENTITLEMENTS.starter;
}

export function planDocRow(planKey: string) {
  const k = normalizePlanKey(planKey);
  return (
    SUBSCRIPTION_PLANS_DOC.find((p) => p.id === k) ||
    SUBSCRIPTION_PLANS_DOC.find((p) => p.id === 'starter')!
  );
}
