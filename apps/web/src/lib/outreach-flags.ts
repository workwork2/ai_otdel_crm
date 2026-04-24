/**
 * Локальная сборка плана рассылки без API/ИИ (превью).
 * По умолчанию включено; отключение: NEXT_PUBLIC_OUTREACH_FORCE_LOCAL_PLAN=0
 */
export function isOutreachForceLocalPlan(): boolean {
  return process.env.NEXT_PUBLIC_OUTREACH_FORCE_LOCAL_PLAN !== '0';
}
