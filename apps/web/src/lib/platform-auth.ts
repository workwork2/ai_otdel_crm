const KEY = 'linearize_platform_jwt';

export function getPlatformJwt(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(KEY);
}

export function setPlatformJwt(token: string) {
  sessionStorage.setItem(KEY, token);
}

export function clearPlatformJwt() {
  sessionStorage.removeItem(KEY);
}
