/**
 * Доработка текста: при NEXT_PUBLIC_API_URL — через Nest API (Anthropic → OpenAI → Gemini).
 * Иначе — прямой вызов Gemini, как раньше.
 */
import { getApiBaseUrl, getTenantIdClient, jsonTenantHeaders } from '@/lib/backend-api';

function getGeminiKey(): string | undefined {
  if (typeof process !== 'undefined' && process.env) {
    return process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  }
  return undefined;
}

function localPolish(text: string): string {
  const t = text.trim();
  if (!t) return t;
  const lines = t.split(/\n/).map((l) => l.trim()).filter(Boolean);
  return (
    lines.join('\n') +
    '\n\n—\n[Демо: включите API (NEXT_PUBLIC_API_URL) с ANTHROPIC_API_KEY на сервере или задайте NEXT_PUBLIC_GEMINI_API_KEY для прямого Gemini.]'
  );
}

export async function refineMarketingCopy(
  instruction: string,
  draft: string
): Promise<{ text: string; usedApi: boolean; error?: string }> {
  const base = typeof window !== 'undefined' ? getApiBaseUrl() : null;
  const tid = typeof window !== 'undefined' ? getTenantIdClient() : 't_demo';

  if (base) {
    try {
      const res = await fetch(`${base}/v1/tenant/${tid}/ai/refine`, {
        method: 'POST',
        headers: jsonTenantHeaders(),
        body: JSON.stringify({ instruction: instruction.trim(), draft: draft.trim() }),
      });
      if (res.ok) {
        const data = (await res.json()) as { text?: string; provider?: string; error?: string };
        const text = String(data.text ?? '').trim();
        if (text) {
          return {
            text,
            usedApi: data.provider !== 'stub',
            error: data.error,
          };
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn('API refine failed, fallback:', msg);
    }
  }

  const key = getGeminiKey();
  const prompt = `${instruction.trim()}\n\nИсходный текст:\n---\n${draft}\n---\nВерни только итоговый текст без пояснений.`;

  if (!key) {
    return { text: localPolish(draft), usedApi: false };
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
        }),
      }
    );

    if (!res.ok) {
      const errBody = await res.text();
      return {
        text: localPolish(draft),
        usedApi: false,
        error: `API ${res.status}: ${errBody.slice(0, 200)}`,
      };
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const out =
      data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';

    const cleaned = out.trim();
    if (!cleaned) {
      return { text: localPolish(draft), usedApi: false, error: 'Пустой ответ модели' };
    }
    return { text: cleaned, usedApi: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { text: localPolish(draft), usedApi: false, error: msg };
  }
}
