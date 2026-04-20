/**
 * Опциональная доработка текста через Gemini (Google AI).
 * В .env: NEXT_PUBLIC_GEMINI_API_KEY=... — иначе локальная заглушка для демо.
 */
function getKey(): string | undefined {
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
    '\n\n—\n[Демо: добавьте NEXT_PUBLIC_GEMINI_API_KEY в .env для доработки формулировок через Gemini.]'
  );
}

export async function refineMarketingCopy(
  instruction: string,
  draft: string
): Promise<{ text: string; usedApi: boolean; error?: string }> {
  const key = getKey();
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
