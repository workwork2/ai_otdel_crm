/**
 * Доработка текста: при NEXT_PUBLIC_API_URL — через Nest API (Anthropic → OpenAI → Gemini).
 * Иначе — прямой вызов Gemini, как раньше.
 */
import { getApiBaseUrl, getTenantIdClient, jsonTenantHeaders } from '@/lib/backend-api';

/** Только NEXT_PUBLIC_* попадает в клиентский бандл Next.js; `GEMINI_API_KEY` без префикса в браузере недоступен. */
function getBrowserGeminiKey(): string | undefined {
  if (typeof process === 'undefined' || !process.env) return undefined;
  const k = process.env.NEXT_PUBLIC_GEMINI_API_KEY?.trim();
  return k || undefined;
}

function getBrowserGeminiModel(): string {
  if (typeof process === 'undefined' || !process.env) return 'gemini-2.5-flash';
  return process.env.NEXT_PUBLIC_GEMINI_MODEL?.trim() || 'gemini-2.5-flash';
}

/** Ответ API без реальной модели или старый формат stub — не показывать как готовый текст. */
function isAiConfigStubResponse(
  text: string,
  provider: string | undefined
): boolean {
  if (provider === 'stub') return true;
  const t = text.trim();
  if (!t) return false;
  return (
    /\[Задайте GEMINI_API_KEY|\[ИИ недоступен:|apps\/api\/\.env.*ANTHROPIC|Перезапустите API\]/i.test(
      t
    )
  );
}

export async function refineMarketingCopy(
  instruction: string,
  draft: string
): Promise<{ text: string; usedApi: boolean; error?: string }> {
  const base = typeof window !== 'undefined' ? getApiBaseUrl() : null;
  const tid = typeof window !== 'undefined' ? getTenantIdClient().trim() : '';
  /** Сообщение об ошибке с API, если ответ 200 но stub (показать при отсутствии NEXT_PUBLIC ключа). */
  let serverAiHint: string | undefined;

  if (base && tid) {
    try {
      const res = await fetch(`${base}/v1/tenant/${tid}/ai/refine`, {
        method: 'POST',
        headers: jsonTenantHeaders(),
        body: JSON.stringify({ instruction: instruction.trim(), draft: draft.trim() }),
      });
      if (!res.ok) {
        const errBody = await res.text();
        const snippet = errBody.replace(/\s+/g, ' ').trim().slice(0, 280);
        if (res.status === 401) {
          return {
            text: '',
            usedApi: false,
            error: 'Сессия истекла — войдите в кабинет снова.',
          };
        }
        if (res.status === 403) {
          return {
            text: '',
            usedApi: false,
            error:
              snippet ||
              'Доступ к ИИ для этой организации запрещён (тариф или права). Обратитесь к администратору.',
          };
        }
        if (res.status < 500) {
          return {
            text: '',
            usedApi: false,
            error: snippet || `Запрос к API ИИ отклонён (${res.status}).`,
          };
        }
        /* 502/503 — пробуем запасной путь в браузере */
      } else {
        const data = (await res.json()) as { text?: string; provider?: string; error?: string };
        const text = String(data.text ?? '').trim();
        const prov = data.provider;
        if (text && !isAiConfigStubResponse(text, prov)) {
          return {
            text,
            usedApi: prov !== 'stub',
            error: data.error,
          };
        }
        if (prov === 'stub' && data.error?.trim()) {
          serverAiHint = data.error.trim();
        }
        /* stub или пустой ответ — пробуем Gemini из браузера (NEXT_PUBLIC_GEMINI_API_KEY). */
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn('API refine failed, fallback:', msg);
    }
  }

  const key = getBrowserGeminiKey();
  const prompt = `${instruction.trim()}\n\nИсходный текст:\n---\n${draft}\n---\nВерни только итоговый текст без пояснений. Если в исходнике мало смысла — всё равно напиши один короткий дружелюбный абзац для клиента на русском, не копируя случайные символы.`;

  if (!key) {
    return {
      text: '',
      usedApi: false,
      error:
        serverAiHint?.slice(0, 500) ||
        'ИИ на сервере не вернул текст (проверьте логи API и ключи GEMINI_API_KEY / ANTHROPIC_API_KEY в apps/api/.env). Запасной путь: задайте NEXT_PUBLIC_GEMINI_API_KEY в apps/web/.env.local и перезапустите `npm run dev` панели — без префикса NEXT_PUBLIC_ ключ в браузере не виден.',
    };
  }

  try {
    const model = encodeURIComponent(getBrowserGeminiModel());
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
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
        text: '',
        usedApi: false,
        error: `Gemini ${res.status}: ${errBody.slice(0, 200)}`,
      };
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const out =
      data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';

    const cleaned = out.trim();
    if (!cleaned) {
      return { text: '', usedApi: false, error: 'Пустой ответ модели' };
    }
    if (isAiConfigStubResponse(cleaned, undefined)) {
      return {
        text: '',
        usedApi: false,
        error: 'Ответ модели похож на служебное сообщение — попробуйте ещё раз или проверьте ключи.',
      };
    }
    return { text: cleaned, usedApi: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { text: '', usedApi: false, error: msg };
  }
}
