'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutGrid,
  Users,
  Zap,
  BarChart2,
  Settings,
  Radio,
  Waypoints,
  CreditCard,
  MessageSquare,
  BookOpen,
  Headphones,
  Lock,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { ImpersonationBanner } from '@/components/shell/ImpersonationBanner';
import type { PlanEntitlements } from '@/context/SubscriptionContext';
import { useSubscriptionOptional } from '@/context/SubscriptionContext';

type NavItem = {
  href: string;
  icon: typeof LayoutGrid;
  label: string;
  /** Если на тарифе нет функции — ведём в «Мой тариф». */
  feature?: keyof PlanEntitlements;
};

const navGroups: { title: string; items: NavItem[] }[] = [
  {
    title: 'ОСНОВНОЕ',
    items: [
      { href: '/', icon: LayoutGrid, label: 'Главная' },
      { href: '/clients', icon: Users, label: 'Клиенты' },
      { href: '/automations', icon: Zap, label: 'Автоматизация' },
    ],
  },
  {
    title: 'АНАЛИТИКА И СВЯЗЬ',
    items: [
      { href: '/qa', icon: MessageSquare, label: 'Диалоги ИИ', feature: 'qaFullAccess' },
      { href: '/analytics', icon: BarChart2, label: 'Отчёты', feature: 'analyticsAdvanced' },
    ],
  },
  {
    title: 'СИСТЕМА',
    items: [
      { href: '/integrations', icon: Waypoints, label: 'Интеграции', feature: 'integrationsManage' },
      { href: '/settings', icon: Settings, label: 'Настройки ИИ' },
      { href: '/billing', icon: CreditCard, label: 'Мой тариф' },
    ],
  },
  {
    title: 'СПРАВКА',
    items: [
      { href: '/guide', icon: BookOpen, label: 'Центр знаний' },
      { href: '/support', icon: Headphones, label: 'Техподдержка' },
    ],
  },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const sub = useSubscriptionOptional();

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <div className="shell flex flex-col h-[100dvh] w-full bg-[#0a0a0c] overflow-hidden font-sans">
      <header className="h-12 min-h-[48px] border-b border-[#1f1f22] bg-[#0a0a0c] grid grid-cols-[1fr_auto_1fr] items-center px-3 sm:px-4 shrink-0 select-none z-50">
        <div aria-hidden className="min-w-0" />

        <div className="flex justify-center min-w-0">
          <div className="flex items-center gap-2 bg-[#121214] border border-[#1f1f22] px-4 sm:px-6 py-1.5 rounded-md shadow-sm max-w-[min(100vw-4rem,320px)]">
            <Radio className="w-4 h-4 text-[#3b82f6] shrink-0" aria-hidden />
            <span className="text-[12px] sm:text-[13px] font-bold text-white tracking-wide truncate">
              AI Отдел
              <span className="text-[#a1a1aa] font-medium ml-1 hidden sm:inline">
                · лояльность и ИИ-касания
              </span>
            </span>
          </div>
        </div>

        <div className="flex justify-end items-center min-w-0 pr-1">
          {!sub?.loading && sub?.subscription ? (
            <span
              className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border border-violet-500/35 text-violet-300 truncate max-w-[min(160px,28vw)]"
              title={sub.subscription.planLabel}
            >
              {sub.subscription.planLabel}
            </span>
          ) : null}
        </div>
      </header>

      <ImpersonationBanner />

      <div className="flex flex-1 min-h-0 min-w-0 flex-col md:flex-row md:items-stretch">
        <aside className="flex flex-col min-h-0 w-full md:w-[288px] md:shrink-0 md:h-full md:self-stretch border-b md:border-b-0 md:border-r border-[#1f1f22] bg-[#0a0a0c] overflow-hidden">
          <div className="hidden md:block px-4 py-3 border-b border-[#1f1f22] shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#52525b]">
              Навигация
            </span>
          </div>

          <div className="md:hidden px-3 pt-3 pb-2 shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#71717a]">Меню</span>
          </div>

          <nav className="flex md:flex-col gap-2 md:gap-0 px-2 md:px-3 md:space-y-6 min-w-max md:min-w-0 flex-1 min-h-0 overflow-x-auto md:overflow-y-auto md:overflow-x-hidden md:py-4 py-2 custom-scrollbar">
            {navGroups.map((group, idx) => (
              <div key={idx} className="flex md:flex-col gap-1 md:space-y-1">
                <div className="hidden md:block px-4 pb-2 text-[10px] uppercase font-bold tracking-widest text-[#71717a]">
                  {group.title}
                </div>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const locked =
                    !!item.feature &&
                    !!sub?.subscription &&
                    !sub.loading &&
                    !sub.has(item.feature);
                  const href = locked ? '/billing' : item.href;
                  const active = !locked && isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={href}
                      title={locked ? 'Нужен более высокий тариф — откроется раздел оплаты' : undefined}
                      className={cn(
                        'whitespace-nowrap md:w-full flex items-center px-3 md:px-4 py-2 md:py-2.5 rounded-lg transition-all duration-200',
                        active && !locked
                          ? 'bg-[#1f1f22] text-white'
                          : 'text-[#a1a1aa] hover:text-[#d4d4d8] hover:bg-[#121214]',
                        locked && 'opacity-80'
                      )}
                    >
                      <Icon
                        className={cn(
                          'w-5 h-5 flex-shrink-0 transition-colors',
                          active && !locked ? 'text-white' : 'text-[#71717a]'
                        )}
                        strokeWidth={active && !locked ? 2 : 1.5}
                      />
                      <span className="ml-2 md:ml-3 text-[13px] md:text-[14px] font-medium flex items-center gap-1.5">
                        {item.label}
                        {locked ? <Lock className="w-3 h-3 text-amber-500/90 shrink-0" /> : null}
                      </span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </aside>

        <main className="flex-1 flex flex-col min-w-0 min-h-0 bg-[#0a0a0c] relative">
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={pathname}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.12 }}
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
