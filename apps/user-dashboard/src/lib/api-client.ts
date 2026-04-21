import { pushToast } from '@/lib/toast';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export type ApiJsonResult<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; error: string; status?: number };

export type ApiFetchOptions = RequestInit & {
  retries?: number;
  /** Не показывать toast при ошибке */
  silent?: boolean;
};

function parseNestMessage(body: string): string | null {
  try {
    const j = JSON.parse(body) as { message?: string | string[] };
    const m = j.message;
    if (Array.isArray(m)) return m.join(', ');
    if (typeof m === 'string' && m.trim()) return m;
  } catch {
    /* plain text */
  }
  return null;
}

function humanError(status: number, body: string): string {
  const parsed = parseNestMessage(body);
  if (parsed) return parsed;
  if (status === 401) return 'Нет доступа (проверьте API-ключ).';
  if (status === 403) return 'Действие недоступно на текущем тарифе.';
  if (status >= 500) return 'Сервер временно недоступен. Повторите через минуту.';
  return body?.slice(0, 280) || `Ошибка ${status}`;
}

/**
 * fetch + JSON + повторы при сетевой ошибке / 502–504.
 */
export async function apiFetchJson<T>(
  url: string,
  init?: ApiFetchOptions
): Promise<ApiJsonResult<T>> {
  const retries = init?.retries ?? 2;
  const silent = init?.silent ?? false;
  const { retries: _r, silent: _s, ...reqInit } = init ?? {};

  let lastMsg = 'Нет соединения с сервером';

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, reqInit);
      const text = await res.text();
      if (res.ok) {
        try {
          const data = (text ? JSON.parse(text) : {}) as T;
          return { ok: true, data, status: res.status };
        } catch {
          lastMsg = 'Некорректный ответ сервера';
          if (!silent) pushToast(lastMsg, 'error');
          return { ok: false, error: lastMsg, status: res.status };
        }
      }
      lastMsg = humanError(res.status, text);
      if ((res.status >= 500 || res.status === 429) && attempt < retries) {
        await sleep(350 * (attempt + 1));
        continue;
      }
      if (!silent) pushToast(lastMsg, 'error');
      return { ok: false, error: lastMsg, status: res.status };
    } catch (e) {
      lastMsg = e instanceof Error ? e.message : 'Сеть недоступна';
      if (attempt < retries) await sleep(400 * (attempt + 1));
    }
  }

  if (!silent) pushToast(lastMsg, 'error');
  return { ok: false, error: lastMsg };
}
