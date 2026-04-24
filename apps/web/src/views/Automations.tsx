'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ToggleLeft,
  ToggleRight,
  Sparkles,
  MessageCircle,
  Layers,
  Calendar,
  RefreshCcw,
  ShoppingCart,
  Package,
  Star,
  Bell,
  UserPlus,
  Clock,
  Target,
} from 'lucide-react';
import { getApiBaseUrl, getTenantIdClient, jsonTenantHeaders, tenantFetchHeaders } from '@/lib/backend-api';
import { apiFetchJson } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useSubscription } from '@/context/SubscriptionContext';
import { pushToast } from '@/lib/toast';
import {
  AUTOMATION_RULE_CATALOG,
  type AutomationIconKey,
  pickAutomationCopy,
} from '@/lib/automation-catalog';

type AutoRow = {
  id: string;
  name: string;
  desc: string;
  tag?: string;
  status: 'active' | 'paused';
};

const ICONS: Record<AutomationIconKey, React.ReactNode> = {
  reactivation: <RefreshCcw className="w-6 h-6 text-[#3b82f6]" />,
  nps: <MessageCircle className="w-6 h-6 text-[#10b981]" />,
  loyalty_burn: <Layers className="w-6 h-6 text-[#f59e0b]" />,
  birthday: <Calendar className="w-6 h-6 text-[#8b5cf6]" />,
  abandoned_cart: <ShoppingCart className="w-6 h-6 text-[#ec4899]" />,
  post_sale: <Package className="w-6 h-6 text-[#06b6d4]" />,
  tier: <Star className="w-6 h-6 text-[#eab308]" />,
  seasonal: <Bell className="w-6 h-6 text-[#f97316]" />,
  onboarding: <UserPlus className="w-6 h-6 text-[#22c55e]" />,
  appointment: <Clock className="w-6 h-6 text-[#a855f7]" />,
  winback: <Target className="w-6 h-6 text-[#14b8a6]" />,
};

function buildPayloadFromRules(): AutoRow[] {
  return AUTOMATION_RULE_CATALOG.map((r) => ({
    id: r.id,
    name: r.name,
    desc: r.desc,
    tag: r.tag,
    status: r.defaultStatus,
  }));
}

export function Automations() {
  const apiBase = getApiBaseUrl();
  const { subscription } = useSubscription();
  const maxActive = subscription?.entitlements.maxActiveAutomations ?? 99;
  const [tenantId, setTenantId] = useState(() => getTenantIdClient());
  const [autoRows, setAutoRows] = useState<AutoRow[] | null>(null);
  const [localOverrides, setLocalOverrides] = useState<Record<string, 'active' | 'paused'>>({});

  useEffect(() => {
    const sync = () => setTenantId(getTenantIdClient());
    sync();
    window.addEventListener('focus', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('focus', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!apiBase) {
      setAutoRows(null);
      return;
    }
    const res = await apiFetchJson<AutoRow[]>(`${apiBase}/v1/tenant/${tenantId}/automations`, {
      headers: tenantFetchHeaders(),
      retries: 2,
      silent: true,
    });
    if (res.ok && Array.isArray(res.data) && res.data.length > 0) setAutoRows(res.data);
    else if (res.ok) setAutoRows(buildPayloadFromRules());
    else setAutoRows(null);
  }, [apiBase, tenantId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const merged = useMemo(() => {
    const base = autoRows;
    return AUTOMATION_RULE_CATALOG.map((rule) => {
      const row = base?.find((a) => a.name === rule.name);
      const local = localOverrides[rule.name];
      const { displayName, displayDesc } = pickAutomationCopy(rule, 'mixed');
      return {
        id: row?.id ?? rule.id,
        icon: ICONS[rule.icon],
        canonicalName: rule.name,
        displayName,
        displayDesc,
        tag: rule.tag,
        status: local ?? row?.status ?? rule.defaultStatus,
      };
    });
  }, [autoRows, localOverrides]);

  const activeCount = merged.filter((r) => r.status === 'active').length;

  const persistToggle = useCallback(
    async (id: string, ruleName: string, nextActive: boolean) => {
      const status: 'active' | 'paused' = nextActive ? 'active' : 'paused';
      if (!apiBase) {
        setLocalOverrides((o) => ({ ...o, [ruleName]: status }));
        return;
      }
      const base = autoRows ?? buildPayloadFromRules();
      const prevRow = base.find((x) => x.id === id);
      const prevActiveCount = base.filter((x) => x.status === 'active').length;
      if (status === 'active' && prevRow?.status !== 'active' && prevActiveCount >= maxActive) {
        pushToast(
          `На тарифе до ${maxActive} активных сценариев. Отключите другой или откройте «Мой тариф».`,
          'error'
        );
        return;
      }
      const next = base.map((x) => (x.id === id ? { ...x, status } : x));
      const res = await apiFetchJson<AutoRow[]>(`${apiBase}/v1/tenant/${tenantId}/automations`, {
        method: 'PUT',
        headers: jsonTenantHeaders(),
        body: JSON.stringify({ automations: next }),
        retries: 1,
      });
      if (res.ok) setAutoRows(res.data);
      else pushToast(res.error || 'Не удалось сохранить сценарии', 'error');
    },
    [apiBase, tenantId, autoRows, maxActive]
  );

  return (
    <div className="crm-page crm-page--std custom-scrollbar space-y-6 sm:space-y-8 fade-in">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="crm-page-h1 flex items-center gap-3 flex-wrap">
            <Sparkles className="w-7 h-7 sm:w-8 sm:h-8 text-[#3b82f6] shrink-0" />
            <span>Автоматизация и сценарии</span>
          </h1>
          <p className="crm-page-lead max-w-2xl">
            Включайте и выключайте готовые сценарии: реактивация, дни рождения, брошенная корзина и другие.
            {apiBase ? ' Состояние сохраняется в API.' : ''}
          </p>
        </div>
        <div className="text-xs font-mono text-[#71717a] border border-[#1f1f22] rounded-lg px-3 py-2 bg-[#121214] shrink-0">
          Активных:{' '}
          <span className="text-[#10b981] font-semibold">{activeCount}</span> / лимит тарифа{' '}
          <span className="text-zinc-300">{maxActive}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 pt-2">
        {merged.map((rule) => (
          <RuleCard
            key={rule.canonicalName}
            icon={rule.icon}
            title={rule.displayName}
            desc={rule.displayDesc}
            status={rule.status}
            tag={rule.tag}
            onToggle={(on) => void persistToggle(rule.id, rule.canonicalName, on)}
          />
        ))}
      </div>
    </div>
  );
}

function RuleCard({
  title,
  desc,
  status,
  icon,
  tag,
  onToggle,
}: {
  title: string;
  desc: string;
  status: 'active' | 'paused';
  icon: React.ReactNode;
  tag?: string;
  onToggle: (active: boolean) => void;
}) {
  const isActive = status === 'active';

  return (
      <div
      className={cn(
        'crm-card p-6 border-l-4 transition-all duration-300 flex flex-col min-h-[200px] ring-1 ring-white/[0.04]',
        isActive
          ? 'border-l-[#3b82f6] shadow-[0_0_24px_rgba(59,130,246,0.07)]'
          : 'border-l-[#1f1f22]'
      )}
    >
      <div className="flex justify-between items-start mb-4 gap-2">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#161618] to-[#0f0f11] border border-[#27272a] flex items-center justify-center shrink-0 shadow-inner">
          {icon}
        </div>

        <button
          type="button"
          onClick={() => onToggle(!isActive)}
          className="text-[#71717a] hover:text-white transition-colors shrink-0"
          aria-pressed={isActive}
        >
          {isActive ? (
            <ToggleRight className="w-8 h-8 text-[#3b82f6]" />
          ) : (
            <ToggleLeft className="w-8 h-8 text-[#71717a]" />
          )}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-2">
        <h3 className="text-[16px] font-semibold text-white leading-snug">{title}</h3>
        {tag && (
          <span className="text-[10px] uppercase tracking-wider text-[#71717a] border border-[#27272a] px-1.5 py-0.5 rounded">
            {tag}
          </span>
        )}
      </div>
      <p className="text-sm text-[#a1a1aa] leading-relaxed mb-5 flex-1">{desc}</p>

      <div className="flex items-center gap-2 mt-auto">
        {isActive ? (
          <span className="px-2 py-1 rounded bg-[#3b82f6]/10 text-[#3b82f6] text-xs font-bold uppercase tracking-wider">
            Включено
          </span>
        ) : (
          <span className="px-2 py-1 rounded bg-[#1f1f22] text-[#a1a1aa] text-xs font-bold uppercase tracking-wider">
            Выключено
          </span>
        )}
      </div>
    </div>
  );
}
