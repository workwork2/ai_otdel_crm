'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Shield, Loader2 } from 'lucide-react';
import { PasswordInput } from '@/components/platform/PasswordInput';
import { getApiBaseUrl } from '@/lib/backend-api';
import { PLATFORM_BASE } from '@/lib/platform-routes';
import { setPlatformJwt } from '@/lib/platform-auth';

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Как на API: достаточно непустых локальной и доменной частей (точка в домене не обязательна — см. admin@localhost). */
function isValidPlatformEmail(email: string): boolean {
  const t = email.trim().toLowerCase();
  if (!t.includes('@')) return false;
  const at = t.indexOf('@');
  const local = t.slice(0, at);
  const domain = t.slice(at + 1);
  return Boolean(local.length && domain.length);
}

export default function PlatformLoginPage() {
  const [needsBootstrap, setNeedsBootstrap] = useState<boolean | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const api = getApiBaseUrl();

  const emailNorm = useMemo(() => normalizeEmail(email), [email]);
  const pwdLen = password.length;
  const pwdBytes = useMemo(() => new TextEncoder().encode(password).length, [password]);

  const bootstrapValid =
    needsBootstrap === true && isValidPlatformEmail(emailNorm) && pwdLen >= 8 && pwdBytes <= 72;
  const loginValid =
    needsBootstrap === false && isValidPlatformEmail(emailNorm) && pwdLen > 0 && pwdBytes <= 72;
  const canSubmit = needsBootstrap != null && (bootstrapValid || loginValid) && !loading;

  const loadStatus = useCallback(() => {
    if (!api) return;
    setStatusError(null);
    setNeedsBootstrap(null);
    void (async () => {
      try {
        const r = await fetch(`${api}/v1/auth/platform/status`);
        if (r.ok) {
          const d = (await r.json()) as { needsBootstrap?: boolean };
          setNeedsBootstrap(!!d.needsBootstrap);
        } else {
          setStatusError(`API ответил ${r.status}. Проверьте, что сервер запущен.`);
          setNeedsBootstrap(false);
        }
      } catch {
        setStatusError('Не удалось связаться с API. Проверьте NEXT_PUBLIC_API_URL и сеть.');
        setNeedsBootstrap(false);
      }
    })();
  }, [api]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!api) {
      setErr('API не настроен (NEXT_PUBLIC_API_URL)');
      return;
    }
    if (needsBootstrap === true) {
      if (!isValidPlatformEmail(emailNorm)) {
        setErr('Введите email (есть символ @ и часть после него)');
        return;
      }
      if (pwdLen < 8) {
        setErr('Пароль не короче 8 символов');
        return;
      }
      if (pwdBytes > 72) {
        setErr('Пароль слишком длинный для безопасного хеширования');
        return;
      }
    } else if (needsBootstrap === false) {
      if (!emailNorm) {
        setErr('Укажите email');
        return;
      }
      if (!password) {
        setErr('Введите пароль');
        return;
      }
      if (pwdBytes > 72) {
        setErr('Пароль слишком длинный');
        return;
      }
    }

    setLoading(true);
    try {
      const path = needsBootstrap ? 'bootstrap' : 'login';
      const r = await fetch(`${api}/v1/auth/platform/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailNorm, password }),
      });
      const data = (await r.json().catch(() => ({}))) as { accessToken?: string; message?: string | string[] };
      if (!r.ok) {
        const msg = Array.isArray(data.message) ? data.message.join(', ') : data.message;
        setErr(msg || `Ошибка ${r.status}`);
        return;
      }
      if (data.accessToken) {
        setPlatformJwt(data.accessToken);
        window.location.href = PLATFORM_BASE;
        return;
      }
      setErr('Нет токена в ответе');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Сеть');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-amber-500/25 bg-gradient-to-b from-amber-950/40 to-zinc-950/90 p-8 shadow-[0_0_60px_-20px_rgba(245,158,11,0.35)]">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/35 flex items-center justify-center">
            <Shield className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Control Plane</h1>
            <p className="text-xs text-amber-600/90">Вход главного администратора</p>
          </div>
        </div>

        {!api ? (
          <p className="text-sm text-red-400">Задайте NEXT_PUBLIC_API_URL и перезапустите приложение.</p>
        ) : needsBootstrap === null ? (
          <p className="text-sm text-zinc-500 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Проверка API…
          </p>
        ) : (
          <>
            {statusError ? (
              <div className="mb-4 space-y-2 rounded-lg border border-red-500/30 bg-red-950/40 px-3 py-2 text-sm text-red-200">
                <p>{statusError}</p>
                <button
                  type="button"
                  onClick={() => loadStatus()}
                  className="text-xs font-semibold text-amber-300 underline underline-offset-2 hover:text-amber-200"
                >
                  Повторить проверку
                </button>
              </div>
            ) : null}

            {needsBootstrap ? (
              <p className="text-sm text-amber-200/90 mb-4 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2">
                Первый запуск: создайте учётную запись владельца платформы. Пароль от 8 символов, не длиннее 72 байт в
                UTF-8.
              </p>
            ) : (
              <p className="text-sm text-zinc-500 mb-4">
                Войдите под учётной записью владельца платформы. Доступ без входа отключён.
              </p>
            )}

            <form onSubmit={(e) => void submit(e)} className="space-y-0" noValidate>
              <label htmlFor="platform-email" className="block text-xs text-zinc-500 mb-1">
                Email
              </label>
              <input
                id="platform-email"
                type="email"
                name="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full mb-3 rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50"
              />
              <label htmlFor="platform-password" className="block text-xs text-zinc-500 mb-1">
                Пароль
              </label>
              <PasswordInput
                id="platform-password"
                name="password"
                autoComplete={needsBootstrap ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mb-4"
              />

              {needsBootstrap ? (
                <p className="text-[11px] text-zinc-500 mb-3 -mt-2">
                  {pwdLen > 0 && pwdLen < 8 ? 'Ещё минимум ' + (8 - pwdLen) + ' символов' : null}
                  {pwdBytes > 72 ? 'Слишком длинный пароль' : null}
                </p>
              ) : null}

              {err ? <p className="text-xs text-red-400 mb-3">{err}</p> : null}

              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-amber-500/90 hover:bg-amber-400 text-zinc-950 font-semibold py-2.5 text-sm disabled:opacity-50 disabled:pointer-events-none"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {needsBootstrap ? 'Создать админа и войти' : 'Войти'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
