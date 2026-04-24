'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Building2,
  Brain,
  Activity,
  Shield,
  UserPlus,
  Headphones,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { getApiBaseUrl } from '@/lib/backend-api';
import { clearPlatformJwt, getPlatformJwt } from '@/lib/platform-auth';
import { PLATFORM_BASE } from '@/lib/platform-routes';

const P = PLATFORM_BASE;

const navGroups = [
  {
    title: 'ОБЗОР',
    items: [{ href: P, icon: LayoutDashboard, label: 'MRR и метрики' }],
  },
  {
    title: 'КЛИЕНТЫ',
    items: [
      { href: `${P}/tenants`, icon: Building2, label: 'Все организации' },
      { href: `${P}/onboarding`, icon: UserPlus, label: 'После оплаты' },
    ],
  },
  {
    title: 'ПОДДЕРЖКА',
    items: [{ href: `${P}/support`, icon: Headphones, label: 'Чаты и тикеты' }],
  },
  {
    title: 'ПЛАТФОРМА',
    items: [
      { href: `${P}/ai`, icon: Brain, label: 'ИИ и промпты' },
      { href: `${P}/monitoring`, icon: Activity, label: 'Мониторинг' },
    ],
  },
];

export function SuperAdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [jwtPresent, setJwtPresent] = React.useState(false);

  useEffect(() => {
    setJwtPresent(!!getPlatformJwt());
  }, [pathname]);

  useEffect(() => {
    if (pathname === `${P}/login` || pathname.startsWith(`${P}/login`)) return;
    const api = getApiBaseUrl();
    if (!api) return;
    if (!getPlatformJwt()) {
      router.replace(`${P}/login`);
    }
  }, [pathname, router]);

  const isActive = (href: string) => {
    if (href === P) return pathname === P || pathname === `${P}/`;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <div className="flex flex-col h-[100dvh] w-full overflow-hidden font-sans">
      <header className="sa-header min-h-[52px] grid grid-cols-[1fr_auto_1fr] items-center px-3 sm:px-5 py-2 shrink-0 select-none z-50">
        <div className="justify-self-start min-w-0 max-w-[min(100%,14rem)]">
          <span className="hidden sm:block text-[10px] uppercase tracking-widest text-zinc-600 font-semibold leading-tight">
            Отдельно от CRM
          </span>
          <span className="hidden sm:block text-[10px] text-zinc-500 mt-0.5">
            Вход клиентов — только через «Все организации»
          </span>
        </div>

        <div className="flex justify-center min-w-0">
          <div className="flex items-center gap-2.5 rounded-xl border border-amber-500/25 bg-gradient-to-br from-amber-950/50 to-zinc-950/80 px-4 sm:px-6 py-2 shadow-[0_0_40px_-8px_rgba(245,158,11,0.25)] max-w-[min(100vw-8rem,380px)]">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center border border-amber-500/30">
              <Shield className="w-4 h-4 text-amber-400" aria-hidden />
            </div>
            <div className="min-w-0">
              <span className="text-[13px] sm:text-sm font-bold text-white tracking-tight block truncate">
                AI Отдел
              </span>
              <span className="text-[10px] text-amber-600/90 uppercase tracking-[0.2em] font-semibold">
                Control Plane · Super Admin
              </span>
            </div>
          </div>
        </div>

        <div className="flex justify-end items-center gap-2 min-w-0">
          {jwtPresent ? (
            <button
              type="button"
              onClick={() => {
                clearPlatformJwt();
                setJwtPresent(false);
                router.replace(`${P}/login`);
              }}
              className="text-[10px] sm:text-xs text-zinc-500 hover:text-amber-200 px-2 py-1 rounded border border-zinc-700/80"
            >
              Выйти
            </button>
          ) : null}
        </div>
      </header>

      <div className="flex flex-1 min-h-0 min-w-0 flex-col md:flex-row md:items-stretch">
        <aside className="sa-sidebar flex flex-col min-h-0 w-full md:w-[288px] md:shrink-0 md:h-full md:self-stretch border-b md:border-b-0 md:border-r overflow-hidden">
          <div className="hidden md:block px-4 py-3 border-b border-amber-900/15 shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-700/70">
              Меню
            </span>
          </div>

          <div className="md:hidden px-3 pt-3 pb-2 shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-700/60">
              Разделы
            </span>
          </div>

          <nav className="flex md:flex-col gap-2 md:gap-0 px-2 md:px-3 md:space-y-5 min-w-max md:min-w-0 flex-1 min-h-0 overflow-x-auto md:overflow-y-auto md:overflow-x-hidden md:py-4 py-2 custom-scrollbar">
            {navGroups.map((group, idx) => (
              <div key={idx} className="flex md:flex-col gap-1 md:space-y-1">
                <div className="hidden md:block px-4 pb-1.5 text-[10px] uppercase font-bold tracking-widest text-zinc-600">
                  {group.title}
                </div>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'group whitespace-nowrap md:w-full flex items-center gap-3 px-3 md:px-3.5 py-2.5 md:py-2.5 rounded-xl transition-all duration-200',
                        active
                          ? 'bg-gradient-to-r from-amber-950/60 to-amber-950/20 text-amber-50 border border-amber-600/35 shadow-[inset_0_1px_0_rgba(251,191,36,0.12)]'
                          : 'text-zinc-400 hover:text-amber-100/90 hover:bg-zinc-900/50 border border-transparent'
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors',
                          active
                            ? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                            : 'border-zinc-700/80 bg-zinc-900/80 text-zinc-500 group-hover:border-amber-900/50 group-hover:text-amber-500/80'
                        )}
                      >
                        <Icon className="w-[18px] h-[18px]" strokeWidth={active ? 2 : 1.5} />
                      </span>
                      <span className="text-[13px] md:text-[14px] font-medium">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </aside>

        <main className="flex-1 flex flex-col min-w-0 min-h-0 relative min-h-0">
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={pathname}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="w-full flex-1 min-h-0 flex flex-col overflow-hidden"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}
