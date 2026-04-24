type BillingLike = {
  messagesUsed: number;
  messagesLimit: number;
  audienceUsed: number;
  audienceLimit: number;
};

export type OutreachLaunchLimitInfo = {
  /** Максимум контактов в одном запуске с учётом тарифа (не больше 500). */
  limit: number;
  messagesLeft: number;
  audienceHeadroom: number;
  /** Нельзя отправить ни одного сообщения / нет места в аудитории. */
  exhausted: boolean;
};

/**
 * Верхняя граница размера кампании: min(500, остаток сообщений, свободные слоты аудитории).
 */
export function computeOutreachLaunchLimit(
  billing: BillingLike | null | undefined,
  subLoading: boolean
): OutreachLaunchLimitInfo {
  if (subLoading) {
    return { limit: 500, messagesLeft: 10_000, audienceHeadroom: 10_000, exhausted: false };
  }
  if (!billing) {
    return { limit: 500, messagesLeft: 500, audienceHeadroom: 500, exhausted: false };
  }
  const messagesLeft = Math.max(0, billing.messagesLimit - billing.messagesUsed);
  const audienceHeadroom = Math.max(0, billing.audienceLimit - billing.audienceUsed);
  const raw = Math.min(500, messagesLeft, audienceHeadroom);
  const exhausted = raw < 1;
  return {
    limit: exhausted ? 0 : raw,
    messagesLeft,
    audienceHeadroom,
    exhausted,
  };
}
