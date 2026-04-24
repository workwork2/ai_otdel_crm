'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, LogIn } from 'lucide-react';
import { getApiBaseUrl } from '@/lib/backend-api';
import { clearImpersonation } from '@/lib/impersonation';
import { clearTenantSession, setTenantSession } from '@/lib/tenant-auth';
import { PasswordInput } from '@/components/ui/PasswordInput';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tenantId, setTenantId] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [codeBusy, setCodeBusy] = useState(true);
  const api = getApiBaseUrl();

  const inviteCode = searchParams.get('code');
  const nextPath = searchParams.get('next') || '/';

  useEffect(() => {
    if (!inviteCode || !api) {
      setCodeBusy(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch(`${api}/v1/auth/tenant/exchange-code`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: inviteCode }),
        });
        const data = (await r.json().catch(() => ({}))) as {
          accessToken?: string;
          tenantId?: string;
          message?: string | string[];
        };
        if (cancelled) return;
        if (!r.ok) {
          const msg = Array.isArray(data.message) ? data.message.join(', ') : data.message;
          setErr(msg || `Ошибка ${r.status}`);
          setCodeBusy(false);
          return;
        }
        if (data.accessToken && data.tenantId) {
          clearImpersonation();
          setTenantSession(data.accessToken, data.tenantId);
          router.replace(nextPath);
          return;
        }
        setErr('Нет токена в ответе');
      } catch {
        if (!cancelled) setErr('Сеть или API недоступны');
      } finally {
        if (!cancelled) setCodeBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, inviteCode, router, nextPath]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!api) {
      setErr('Задайте NEXT_PUBLIC_API_URL');
      return;
    }
    const tid = tenantId.trim();
    if (!tid) {
      setErr('Укажите ID организации');
      return;
    }
    if (!password) {
      setErr('Введите пароль');
      return;
    }
    const pwdBytes = new TextEncoder().encode(password).length;
    if (pwdBytes > 72) {
      setErr('Пароль слишком длинный');
      return;
    }
    setLoading(true);
    try {
      const r = await fetch(`${api}/v1/auth/tenant/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: tid, password }),
      });
      const data = (await r.json().catch(() => ({}))) as {
        accessToken?: string;
        tenantId?: string;
        message?: string | string[];
      };
      if (!r.ok) {
        const msg = Array.isArray(data.message) ? data.message.join(', ') : data.message;
        setErr(msg || `Ошибка ${r.status}`);
        return;
      }
      if (data.accessToken && data.tenantId) {
        clearImpersonation();
        setTenantSession(data.accessToken, data.tenantId);
        router.replace(nextPath);
        return;
      }
      setErr('Нет токена в ответе');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Сеть');
    } finally {
      setLoading(false);
    }
  };

  if (!api) {
    return (
      <p className="text-sm text-red-400 text-center max-w-md">
        Укажите <code className="text-xs">NEXT_PUBLIC_API_URL</code> в <code className="text-xs">.env.local</code> и
        перезапустите приложение.
      </p>
    );
  }

  if (codeBusy && inviteCode) {
    return (
      <p className="text-sm text-zinc-400 flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Вход по приглашению…
      </p>
    );
  }

  const canSubmit = !loading && tenantId.trim().length > 0 && password.length > 0;

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="space-y-0">
      <p className="text-sm text-zinc-500 mb-4">
        Введите ID организации (например <span className="font-mono text-zinc-400">t_…</span>) и пароль панели. Пароль
        задаёт главный администратор в супер-админке.
      </p>
      <label htmlFor="portal-tenant-id" className="block text-xs text-zinc-500 mb-1">
        ID организации
      </label>
      <input
        id="portal-tenant-id"
        name="tenantId"
        value={tenantId}
        onChange={(e) => setTenantId(e.target.value)}
        autoComplete="username"
        placeholder="t_abc123…"
        className="w-full mb-3 rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-sky-500/50"
      />
      <label htmlFor="portal-password" className="block text-xs text-zinc-500 mb-1">
        Пароль
      </label>
      <PasswordInput
        id="portal-password"
        name="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
        className="mb-4"
      />
      {err ? <p className="text-xs text-red-400 mb-3">{err}</p> : null}
      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold py-2.5 text-sm disabled:opacity-50 disabled:pointer-events-none"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
        Войти
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-4 py-12 bg-[#0a0a0c]">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950/80 p-8 shadow-xl">
        <h1 className="text-xl font-semibold text-white mb-1">AI Отдел</h1>
        <p className="text-xs text-zinc-500 uppercase tracking-widest mb-6">Вход в панель организации</p>
        <Suspense
          fallback={
            <p className="text-sm text-zinc-500 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Загрузка…
            </p>
          }
        >
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
