export function getApiBaseUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (raw) return raw.replace(/\/$/, '');
  if (typeof window !== 'undefined') {
    const h = window.location.hostname;
    if (h === 'localhost' || h === '127.0.0.1') return 'http://localhost:3333';
  }
  if (process.env.NODE_ENV === 'development') return 'http://localhost:3333';
  return null;
}

export function superFetchHeaders(): HeadersInit {
  const h: Record<string, string> = {};
  const key = process.env.NEXT_PUBLIC_SUPER_ADMIN_KEY?.trim();
  if (key) h['X-Super-Admin-Key'] = key;
  return h;
}

export function jsonSuperHeaders(): HeadersInit {
  return { ...superFetchHeaders(), 'Content-Type': 'application/json' };
}
