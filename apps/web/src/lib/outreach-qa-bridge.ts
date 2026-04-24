/** Ключ sessionStorage: переход из «Рассылка» в «Диалоги ИИ» с текстом письма. */
export const OUTREACH_LETTER_QA_KEY = 'linearize-outreach-letter-qa';

export type OutreachLetterQaPayload = {
  slotId: string;
  customerName: string;
  email: string;
  subject: string;
  bodyText: string;
  ts: number;
};

export function storeOutreachLetterForQa(payload: Omit<OutreachLetterQaPayload, 'ts'>) {
  if (typeof window === 'undefined') return;
  try {
    const data: OutreachLetterQaPayload = { ...payload, ts: Date.now() };
    sessionStorage.setItem(OUTREACH_LETTER_QA_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}
