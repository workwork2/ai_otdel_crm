'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Database,
  RefreshCw,
  Send,
  Mails,
  CheckCircle2,
  Circle,
  AlertCircle,
  Loader2,
  Target,
  Sparkles,
  Save,
  MessageSquare,
  FlaskConical,
  Settings,
  CalendarClock,
  Pause,
  Play,
  Megaphone,
  Tag,
  Percent,
} from 'lucide-react';
import { CrmPage } from '@/components/layout/CrmPage';
import { getApiBaseUrl, getTenantIdClient, jsonTenantHeaders, tenantFetchHeaders } from '@/lib/backend-api';
import { apiFetchJson } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useSubscription } from '@/context/SubscriptionContext';
import { useAudienceData } from '@/context/AudienceDataContext';
import { pushToast } from '@/lib/toast';
import type { CustomerProfile } from '@/types';
import {
  buildOutreachLetterDraft,
  buildOutreachScheduleSummary,
  buildWorkflowSteps,
  type OutreachBrainInput,
  type AutoRowLite,
} from '@/lib/outreachLetter';
import { isOutreachForceLocalPlan } from '@/lib/outreach-flags';
import { computeOutreachLaunchLimit } from '@/lib/outreach-limits';
import {
  buildLocalOutreachPlanFromLetter,
  DEMO_DISCOUNT_FALLBACK,
  DEMO_MESSAGES_QUOTA,
  DEMO_PROMO_FALLBACK,
  getOutreachDemoClients,
  hydrateOutreachDemoCampaign,
  readOutreachDemoFlag,
  setOutreachDemoFlag,
} from '@/lib/outreach-plan-demo';
import { storeOutreachLetterForQa } from '@/lib/outreach-qa-bridge';

type RetentionTarget = 'retention' | 'marketing';

type ServerOutreachSlot = {
  id: string;
  customerId: string;
  email: string;
  customerName: string;
  scheduledAt: string;
  subject: string;
  bodyText: string;
  status: 'pending' | 'sent' | 'failed' | 'skipped_limit';
  lastError?: string;
  personalizedByAi: boolean;
};

type ServerOutreachCampaign = {
  version: 1;
  status: 'draft' | 'running' | 'paused' | 'completed';
  target: RetentionTarget;
  planText: string;
  baseSubject: string;
  baseBodyText: string;
  recipientIds: string[];
  updatedAt: number;
  slots: ServerOutreachSlot[];
};

type AutoRow = {
  id: string;
  name: string;
  desc: string;
  tag?: string;
  status: 'active' | 'paused';
};

type EmailStatus = {
  configured?: boolean;
  from?: string;
  source?: string;
};

type IntegrationRowLite = { name: string; status: string };

/** Почта + подключённые каналы из «Интеграции» (WhatsApp, Telegram и т.д.). */
function formatMailingChannelsLine(emailFrom: string | null | undefined, rows: IntegrationRowLite[]): string {
  const connected = (test: (n: string) => boolean) =>
    rows.some((r) => String(r.status).toLowerCase() === 'connected' && test(r.name));
  const parts: string[] = [];
  if (emailFrom?.trim()) parts.push(`Email: ${emailFrom.trim()}`);
  else if (connected((n) => n.includes('Email'))) parts.push('Email');
  if (connected((n) => n.includes('WhatsApp'))) parts.push('WhatsApp');
  if (connected((n) => n.includes('Telegram'))) parts.push('Telegram');
  if (connected((n) => n.includes('SMS'))) parts.push('SMS');
  if (connected((n) => n.includes('MAX'))) parts.push('MAX');
  return parts.length > 0 ? parts.join(' · ') : 'каналы не подключены';
}

function outreachClientContactLines(c: CustomerProfile): {
  primary: string;
  secondary?: string;
  messengers: string[];
} {
  const email = c.email?.trim() || '';
  const phone = c.phone?.trim() || '';
  const primary = email || phone || '—';
  const secondary = email && phone ? phone : undefined;
  const messengers: string[] = [];
  if (c.consent?.whatsapp && phone) messengers.push('WhatsApp');
  if (c.consent?.telegram) messengers.push('Telegram');
  return { primary, secondary, messengers };
}

const LS_LAST_RUN = 'linearize-outreach-last-run';

type LastRunPayload = {
  tenantId: string;
  at: string;
  target: RetentionTarget;
  sent: number;
  attempted: number;
  failed: number;
};

function defaultBrain(): OutreachBrainInput {
  return {
    tone: 50,
    useEmoji: true,
    maxDiscountPercent: 15,
    spamCadence: 'week',
    brandVoicePrompt:
      'Обращайся на «вы», короткие абзацы, без канцелярита. При необходимости уточняй детали заказа.',
    promotions: [],
    discounts: [],
  };
}

function mergeBrain(raw: unknown): OutreachBrainInput {
  const b = raw as Partial<OutreachBrainInput>;
  const d = defaultBrain();
  return {
    ...d,
    ...b,
    promotions: Array.isArray(b.promotions) ? b.promotions : [],
    discounts: Array.isArray(b.discounts) ? b.discounts : [],
  };
}

function isValidCampaignEmail(email: string): boolean {
  const t = email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return false;
  if (t.includes('*')) return false;
  return true;
}

function filterCustomersForCampaign(clients: CustomerProfile[], target: RetentionTarget): CustomerProfile[] {
  return clients.filter((c) => {
    if (!c.consent?.marketing) return false;
    if (!isValidCampaignEmail(c.email)) return false;
    if (target === 'marketing') return true;
    const sc = c.scoring;
    if (!sc) return false;
    const { churnSegment: seg, lifecycle: life } = sc;
    return (
      seg === 'risk_zone' ||
      seg === 'watch' ||
      life === 'dormant' ||
      life === 'at_risk'
    );
  });
}

function readLastRun(tenantId: string): LastRunPayload | null {
  if (typeof window === 'undefined' || !tenantId) return null;
  try {
    const raw = localStorage.getItem(LS_LAST_RUN);
    if (!raw) return null;
    const o = JSON.parse(raw) as LastRunPayload;
    if (o.tenantId !== tenantId) return null;
    if (typeof o.sent !== 'number') return null;
    return o;
  } catch {
    return null;
  }
}

function writeLastRun(p: LastRunPayload) {
  try {
    localStorage.setItem(LS_LAST_RUN, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

function toAutoLite(rows: AutoRow[]): AutoRowLite[] {
  return rows.map((r) => ({ name: r.name, desc: r.desc, tag: r.tag }));
}

function slotStatusLabel(s: ServerOutreachSlot['status']): string {
  switch (s) {
    case 'pending':
      return 'ожидает';
    case 'sent':
      return 'отправлено';
    case 'failed':
      return 'ошибка';
    case 'skipped_limit':
      return 'лимит';
    default:
      return s;
  }
}

/** Превью UI: `?demo=1` или localStorage после включения в баннере */
function initOutreachDemoMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const p = new URLSearchParams(window.location.search);
    if (p.get('demo') === '1') {
      setOutreachDemoFlag(true);
      p.delete('demo');
      const q = p.toString();
      window.history.replaceState(null, '', `${window.location.pathname}${q ? `?${q}` : ''}`);
      return true;
    }
  } catch {
    /* ignore */
  }
  return readOutreachDemoFlag();
}

export function OutreachPlan() {
  const router = useRouter();
  const { clients } = useAudienceData();
  const { has, subscription, loading: subLoading } = useSubscription();
  const canSendCampaign = !subLoading && !!subscription && has('integrationsManage');
  const forceLocalPlan = isOutreachForceLocalPlan();

  const tenantId = getTenantIdClient().trim();
  const apiBase = getApiBaseUrl();

  const [demoMode, setDemoMode] = useState(initOutreachDemoMode);
  const demoModeRef = useRef(demoMode);
  demoModeRef.current = demoMode;

  /** Превью без реальной отправки: нет API/тенанта, нет тарифа с интеграциями, явное демо или ключ NEXT_PUBLIC_OUTREACH_FORCE_LOCAL_PLAN. */
  const localAutoPreview =
    !demoMode &&
    (!apiBase || !tenantId.trim() || (!subLoading && !canSendCampaign));
  const useMockOutreach = demoMode || localAutoPreview || forceLocalPlan;
  const useMockOutreachRef = useRef(useMockOutreach);
  useMockOutreachRef.current = useMockOutreach;

  const [emailStatus, setEmailStatus] = useState<EmailStatus | null>(null);
  const [emailIntConnected, setEmailIntConnected] = useState<boolean | null>(null);
  const [integrationsList, setIntegrationsList] = useState<IntegrationRowLite[]>([]);
  const [automations, setAutomations] = useState<AutoRow[] | null>(null);
  const [brain, setBrain] = useState<OutreachBrainInput>(defaultBrain);
  const [metaLoading, setMetaLoading] = useState(false);

  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [lastRun, setLastRun] = useState<LastRunPayload | null>(null);
  const [runPhase, setRunPhase] = useState<'idle' | 'sending' | 'done'>('idle');

  const [serverCampaign, setServerCampaign] = useState<ServerOutreachCampaign | null>(null);
  const [messagesQuota, setMessagesQuota] = useState<{ used: number; limit: number } | null>(null);
  const [generatePlanBusy, setGeneratePlanBusy] = useState(false);
  const [savePlanBusy, setSavePlanBusy] = useState(false);
  const [scheduleStartBusy, setScheduleStartBusy] = useState(false);
  const [schedulePauseBusy, setSchedulePauseBusy] = useState(false);
  /** После «Сохранить» (или загрузка плана с сервера) — можно «Запуск». После новой генерации — снова нужно сохранить. */
  const [planCommitted, setPlanCommitted] = useState(false);

  const launchInfo = useMemo(
    () => computeOutreachLaunchLimit(subscription?.billing, subLoading),
    [subscription?.billing, subLoading]
  );
  const launchLimit = launchInfo.exhausted ? 0 : Math.min(500, Math.max(1, launchInfo.limit));

  const clientsForOutreach = useMemo(() => {
    if (!useMockOutreach) return clients;
    const demo = getOutreachDemoClients();
    const ids = new Set(clients.map((c) => c.id));
    return [...clients, ...demo.filter((c) => !ids.has(c.id))];
  }, [clients, useMockOutreach]);

  /** ИИ-логика отбора: удержание первыми, затем дозаполнение с согласием до лимита (на сервер уходит как marketing-когорта). */
  const aiSelectedList = useMemo(() => {
    const retention = filterCustomersForCampaign(clientsForOutreach, 'retention');
    const marketing = filterCustomersForCampaign(clientsForOutreach, 'marketing');
    const seen = new Set<string>();
    const out: CustomerProfile[] = [];
    for (const c of retention) {
      if (launchLimit < 1 || out.length >= launchLimit) break;
      if (!seen.has(c.id)) {
        seen.add(c.id);
        out.push(c);
      }
    }
    for (const c of marketing) {
      if (launchLimit < 1 || out.length >= launchLimit) break;
      if (!seen.has(c.id)) {
        seen.add(c.id);
        out.push(c);
      }
    }
    return out;
  }, [clientsForOutreach, launchLimit]);

  const marketingEligible = useMemo(
    () => filterCustomersForCampaign(clientsForOutreach, 'marketing').length,
    [clientsForOutreach]
  );
  const retentionEligible = useMemo(
    () => filterCustomersForCampaign(clientsForOutreach, 'retention').length,
    [clientsForOutreach]
  );

  const letterDraft = useMemo(
    () => buildOutreachLetterDraft(brain, toAutoLite(automations ?? [])),
    [brain, automations]
  );

  /** База для генерации и мгновенной рассылки — только из «Настройки ИИ» и сценариев. */
  const effectiveLetter = letterDraft;

  const letterReady =
    effectiveLetter.subject.trim().length >= 2 && effectiveLetter.body.trim().length >= 4;

  const slotsSent = serverCampaign?.slots.filter((s) => s.status === 'sent').length ?? 0;
  const slotsPending = serverCampaign?.slots.filter((s) => s.status === 'pending').length ?? 0;
  const slotsTotal = serverCampaign?.slots.length ?? 0;

  const brainForWorkflow = useMemo(() => {
    if (!useMockOutreach) return brain;
    return {
      ...brain,
      promotions: brain.promotions?.length ? brain.promotions : [DEMO_PROMO_FALLBACK],
      discounts: brain.discounts?.length ? brain.discounts : [DEMO_DISCOUNT_FALLBACK],
    };
  }, [useMockOutreach, brain]);

  const workflowRelaxed = useMockOutreach && !launchInfo.exhausted;

  const workflowSteps = useMemo(
    () =>
      buildWorkflowSteps({
        clientsCount: workflowRelaxed ? Math.max(clientsForOutreach.length, 12) : clientsForOutreach.length,
        launchLimit: launchInfo.exhausted ? 0 : launchLimit,
        aiRecipientCount: workflowRelaxed ? Math.max(aiSelectedList.length, 8) : aiSelectedList.length,
        brain: brainForWorkflow,
        mailReady: useMockOutreach ? true : !!emailStatus?.configured && emailIntConnected === true,
        hasCampaignDraft: slotsTotal > 0,
        campaignStatus: serverCampaign?.status ?? null,
        slotsSent,
        slotsTotal,
        slotsPending,
        previewShortcuts: workflowRelaxed,
      }),
    [
      workflowRelaxed,
      useMockOutreach,
      clientsForOutreach.length,
      launchLimit,
      aiSelectedList.length,
      brainForWorkflow,
      emailStatus?.configured,
      emailIntConnected,
      slotsTotal,
      serverCampaign?.status,
      slotsSent,
      slotsPending,
      launchInfo.exhausted,
    ]
  );

  const scheduleSummary = useMemo(
    () =>
      serverCampaign?.slots?.length
        ? buildOutreachScheduleSummary(serverCampaign.slots, brain, messagesQuota)
        : null,
    [serverCampaign?.slots, brain, messagesQuota]
  );

  const outreachOffersSummary = useMemo(() => {
    const promos = (brain.promotions ?? []).filter((p) => p.active !== false);
    const discs = (brain.discounts ?? []).filter((d) => d.active !== false);
    const maxPct = typeof brain.maxDiscountPercent === 'number' ? brain.maxDiscountPercent : 15;
    const activeAutos = (automations ?? []).filter((a) => a.status === 'active');
    return { promos, discs, maxPct, activeAutos };
  }, [brain, automations]);

  const mailingStripVisible =
    !!serverCampaign &&
    (serverCampaign.status === 'running' || serverCampaign.slots.some((s) => s.status === 'sent'));

  useEffect(() => {
    if (!useMockOutreach) return;
    if (subscription?.billing) {
      setMessagesQuota({
        used: subscription.billing.messagesUsed,
        limit: subscription.billing.messagesLimit,
      });
    } else {
      setMessagesQuota({ used: DEMO_MESSAGES_QUOTA.used, limit: DEMO_MESSAGES_QUOTA.limit });
    }
    setEmailStatus({ configured: true, from: 'newsletter@demo-brand.ru', source: demoMode ? 'demo' : 'preview' });
    setEmailIntConnected(true);
    setIntegrationsList([
      { name: 'Email', status: 'connected' },
      { name: 'WhatsApp Business API', status: 'connected' },
      { name: 'Telegram Bot', status: 'connected' },
    ]);
  }, [useMockOutreach, demoMode, subscription?.billing]);

  useEffect(() => {
    setLastRun(readLastRun(tenantId));
  }, [tenantId]);

  const loadMeta = useCallback(async () => {
    if (!apiBase || !tenantId) {
      setEmailStatus(null);
      setEmailIntConnected(null);
      setIntegrationsList([]);
      setAutomations(null);
      setBrain(defaultBrain());
      return;
    }
    setMetaLoading(true);
    const [st, ints, autos, br] = await Promise.all([
      apiFetchJson<EmailStatus>(`${apiBase}/v1/tenant/${tenantId}/email/status`, {
        headers: tenantFetchHeaders(),
        retries: 1,
        silent: true,
      }),
      apiFetchJson<Array<{ name: string; status: string }>>(`${apiBase}/v1/tenant/${tenantId}/integrations`, {
        headers: tenantFetchHeaders(),
        retries: 1,
        silent: true,
      }),
      apiFetchJson<AutoRow[]>(`${apiBase}/v1/tenant/${tenantId}/automations`, {
        headers: tenantFetchHeaders(),
        retries: 1,
        silent: true,
      }),
      apiFetchJson<unknown>(`${apiBase}/v1/tenant/${tenantId}/brain`, {
        headers: tenantFetchHeaders(),
        retries: 1,
        silent: true,
      }),
    ]);
    if (getTenantIdClient().trim() !== tenantId) return;
    setEmailStatus(st.ok ? st.data : null);
    if (ints.ok && Array.isArray(ints.data)) {
      setIntegrationsList(ints.data);
      const row = ints.data.find((i) => i.name === 'Email');
      setEmailIntConnected(row?.status === 'connected');
    } else {
      setIntegrationsList([]);
      setEmailIntConnected(false);
    }
    const autosList = autos.ok && Array.isArray(autos.data) ? autos.data : [];
    const merged = br.ok && br.data ? mergeBrain(br.data) : defaultBrain();
    setAutomations(autosList);
    setBrain(merged);
    setMetaLoading(false);
    if (useMockOutreachRef.current || readOutreachDemoFlag()) {
      setEmailStatus({ configured: true, from: 'newsletter@demo-brand.ru', source: 'preview' });
      setEmailIntConnected(true);
      setIntegrationsList([
        { name: 'Email', status: 'connected' },
        { name: 'WhatsApp Business API', status: 'connected' },
        { name: 'Telegram Bot', status: 'connected' },
      ]);
    }
  }, [apiBase, tenantId]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  const fetchServerCampaign = useCallback(async () => {
    if (useMockOutreachRef.current) return;
    if (!apiBase || !tenantId) {
      setServerCampaign(null);
      setMessagesQuota(null);
      return;
    }
    const res = await apiFetchJson<{
      campaign: ServerOutreachCampaign | null;
      messagesUsed: number;
      messagesLimit: number;
    }>(`${apiBase}/v1/tenant/${tenantId}/outreach/campaign`, {
      headers: tenantFetchHeaders(),
      retries: 1,
      silent: true,
    });
    if (!res.ok || getTenantIdClient().trim() !== tenantId) return;
    setServerCampaign(res.data.campaign ?? null);
    setMessagesQuota({
      used: res.data.messagesUsed ?? 0,
      limit: res.data.messagesLimit ?? 0,
    });
    setPlanCommitted(!!res.data.campaign);
  }, [apiBase, tenantId]);

  useEffect(() => {
    if (useMockOutreach) return;
    void fetchServerCampaign();
  }, [useMockOutreach, fetchServerCampaign]);

  useEffect(() => {
    if (useMockOutreach) return;
    if (serverCampaign?.status !== 'running' || !tenantId) return;
    const t = setInterval(() => void fetchServerCampaign(), 10_000);
    return () => clearInterval(t);
  }, [useMockOutreach, serverCampaign?.status, tenantId, fetchServerCampaign]);

  const mailReady = !!emailStatus?.configured && emailIntConnected === true;

  const mailingChannelsLabel = useMemo(
    () => formatMailingChannelsLine(emailStatus?.from ?? null, integrationsList),
    [emailStatus?.from, integrationsList]
  );

  const refreshFromSettings = useCallback(async () => {
    setSettingsBusy(true);
    await loadMeta();
    setSettingsBusy(false);
    if (useMockOutreachRef.current) {
      setEmailStatus({ configured: true, from: 'newsletter@demo-brand.ru', source: 'preview' });
      setEmailIntConnected(true);
    }
    pushToast('Данные из «Настройки ИИ» обновлены', 'success');
  }, [loadMeta]);

  const verifyWithServer = useCallback(async () => {
    if (useMockOutreachRef.current) {
      pushToast('В демо-режиме проверка API отключена — это превью интерфейса.', 'info');
      return;
    }
    if (!apiBase || !tenantId || !canSendCampaign) {
      pushToast('Проверка на сервере доступна с тарифом и Email.', 'info');
      return;
    }
    setVerifying(true);
    const res = await apiFetchJson<{ dryRun?: boolean; count?: number }>(
      `${apiBase}/v1/tenant/${tenantId}/email/retention-campaign`,
      {
        method: 'POST',
        headers: jsonTenantHeaders(),
        body: JSON.stringify({
          target: 'marketing',
          limit: launchLimit,
          dryRun: true,
          recipientIds: aiSelectedList.map((c) => c.id),
        }),
        retries: 0,
        silent: true,
      }
    );
    setVerifying(false);
    if (!res.ok) {
      pushToast(res.error || 'Сервер не ответил', 'error');
      return;
    }
    const cnt = res.data.count ?? 0;
    if (cnt !== aiSelectedList.length) {
      pushToast(`На сервере ${cnt} получателей, в интерфейсе ${aiSelectedList.length}.`, 'error');
    } else {
      pushToast(`Совпадает: ${cnt} получателей`, 'success');
    }
  }, [apiBase, tenantId, canSendCampaign, launchLimit, aiSelectedList]);

  const generateOutreachPlan = useCallback(async () => {
    if (useMockOutreachRef.current) {
      setGeneratePlanBusy(true);
      await new Promise((r) => setTimeout(r, 400));
      setServerCampaign(
        buildLocalOutreachPlanFromLetter({
          baseSubject: effectiveLetter.subject.trim(),
          baseBodyText: effectiveLetter.body.trim(),
          launchLimit,
        }) as ServerOutreachCampaign
      );
      setPlanCommitted(false);
      setGeneratePlanBusy(false);
      pushToast(
        demoModeRef.current
          ? 'Демо: план пересобран локально (без ИИ)'
          : 'План собран локально для превью — без API и без ИИ',
        'success'
      );
      return;
    }
    if (!apiBase || !tenantId || !canSendCampaign) {
      pushToast('Нужен тариф с интеграциями.', 'info');
      return;
    }
    if (aiSelectedList.length === 0) {
      pushToast('Нет получателей в автоматической выборке.', 'error');
      return;
    }
    const sub = effectiveLetter.subject.trim();
    const txt = effectiveLetter.body.trim();
    if (sub.length < 2 || txt.length < 4) {
      pushToast('Недостаточно данных для плана — заполните «Настройки ИИ» и сценарии, затем обновите данные.', 'error');
      return;
    }
    if (
      !confirm(
        `Сгенерировать план для ${aiSelectedList.length} контактов (отбор ИИ: удержание, затем согласие)? Первые отправки не раньше чем примерно через 5 минут после запуска.`
      )
    ) {
      return;
    }
    setGeneratePlanBusy(true);
    const res = await apiFetchJson<ServerOutreachCampaign>(`${apiBase}/v1/tenant/${tenantId}/outreach/generate`, {
      method: 'POST',
      headers: jsonTenantHeaders(),
      body: JSON.stringify({
        target: 'marketing',
        recipientIds: aiSelectedList.map((c) => c.id),
        baseSubject: sub,
        baseBodyText: txt,
      }),
      retries: 0,
    });
    setGeneratePlanBusy(false);
    if (!res.ok) {
      pushToast(res.error || 'Не удалось сгенерировать', 'error');
      return;
    }
    setServerCampaign(res.data);
    setPlanCommitted(false);
    void fetchServerCampaign();
    pushToast('План и слоты готовы — сохраните план, затем можно запускать по расписанию', 'success');
  }, [
    apiBase,
    tenantId,
    canSendCampaign,
    aiSelectedList,
    effectiveLetter.subject,
    effectiveLetter.body,
    launchLimit,
    fetchServerCampaign,
  ]);

  const saveOutreachPlan = useCallback(async () => {
    if (useMockOutreachRef.current) {
      setPlanCommitted(true);
      pushToast('Черновик зафиксирован (превью). Кнопка «Запуск» станет активной; реальная отправка — без демо-режима.', 'success');
      return;
    }
    if (!apiBase || !tenantId || !serverCampaign) return;
    if (serverCampaign.status === 'running') {
      pushToast('Сначала приостановите рассылку', 'info');
      return;
    }
    setSavePlanBusy(true);
    const res = await apiFetchJson<ServerOutreachCampaign>(`${apiBase}/v1/tenant/${tenantId}/outreach/campaign`, {
      method: 'PUT',
      headers: jsonTenantHeaders(),
      body: JSON.stringify({
        planText: serverCampaign.planText,
        baseSubject: serverCampaign.baseSubject,
        baseBodyText: serverCampaign.baseBodyText,
        slots: serverCampaign.slots.map((s) => ({
          id: s.id,
          scheduledAt: s.scheduledAt,
          subject: s.subject,
          bodyText: s.bodyText,
        })),
      }),
      retries: 0,
    });
    setSavePlanBusy(false);
    if (!res.ok) {
      pushToast(res.error || 'Не сохранилось', 'error');
      return;
    }
    setServerCampaign(res.data);
    setPlanCommitted(true);
    pushToast('План сохранён на сервере', 'success');
  }, [apiBase, tenantId, serverCampaign]);

  const startScheduledOutreach = useCallback(async () => {
    if (useMockOutreachRef.current) {
      pushToast('В демо-режиме запуск рассылки отключён.', 'info');
      return;
    }
    if (!apiBase || !tenantId || !canSendCampaign) return;
    if (!mailReady) {
      pushToast('Настройте Email в интеграциях.', 'error');
      return;
    }
    if (!serverCampaign || serverCampaign.slots.filter((s) => s.status === 'pending').length === 0) {
      pushToast('Нет черновика или нечего отправлять.', 'error');
      return;
    }
    if (
      !confirm(
        'Запустить автоматическую отправку по расписанию? Письма уходят по одному согласно времени в таблице и лимиту тарифа.'
      )
    ) {
      return;
    }
    setScheduleStartBusy(true);
    const res = await apiFetchJson<ServerOutreachCampaign>(`${apiBase}/v1/tenant/${tenantId}/outreach/start`, {
      method: 'POST',
      headers: jsonTenantHeaders(),
      retries: 0,
    });
    setScheduleStartBusy(false);
    if (!res.ok) {
      pushToast(res.error || 'Не удалось запустить', 'error');
      return;
    }
    setServerCampaign(res.data);
    void fetchServerCampaign();
    pushToast('Рассылка по расписанию запущена', 'success');
  }, [apiBase, tenantId, canSendCampaign, mailReady, serverCampaign, fetchServerCampaign]);

  const pauseScheduledOutreach = useCallback(async () => {
    if (useMockOutreachRef.current) {
      pushToast('В демо-режиме пауза недоступна.', 'info');
      return;
    }
    if (!apiBase || !tenantId) return;
    setSchedulePauseBusy(true);
    const res = await apiFetchJson<ServerOutreachCampaign>(`${apiBase}/v1/tenant/${tenantId}/outreach/pause`, {
      method: 'POST',
      headers: jsonTenantHeaders(),
      retries: 0,
    });
    setSchedulePauseBusy(false);
    if (!res.ok) {
      pushToast(res.error || 'Не удалось приостановить', 'error');
      return;
    }
    setServerCampaign(res.data);
    void fetchServerCampaign();
    pushToast('Рассылка приостановлена', 'success');
  }, [apiBase, tenantId, fetchServerCampaign]);

  const sendCampaign = useCallback(async () => {
    if (useMockOutreachRef.current) {
      pushToast('В демо-режиме мгновенная отправка отключена.', 'info');
      return;
    }
    if (!apiBase || !tenantId || !canSendCampaign) {
      pushToast('Отправка недоступна.', 'error');
      return;
    }
    if (!mailReady) {
      pushToast('Сначала настройте Email в интеграциях.', 'error');
      return;
    }
    if (aiSelectedList.length === 0) {
      pushToast('Нет получателей в выборке.', 'error');
      return;
    }
    const sub = effectiveLetter.subject.trim();
    const txt = effectiveLetter.body.trim();
    if (sub.length < 2 || txt.length < 4) {
      pushToast('Недостаточно текста для мгновенной рассылки — заполните «Настройки ИИ» и сценарии.', 'error');
      return;
    }
    if (
      !confirm(
        `Отправить ${aiSelectedList.length} писем одним текстом всем сразу?\nЭто не персональная кампания; для индивидуальных писем используйте план и расписание выше. Акции из настроек добавятся при отправке.`
      )
    ) {
      return;
    }
    setSending(true);
    setRunPhase('sending');
    const res = await apiFetchJson<{
      sent?: number;
      attempted?: number;
      failed?: number;
      errors?: string[];
    }>(`${apiBase}/v1/tenant/${tenantId}/email/retention-campaign`, {
      method: 'POST',
      headers: jsonTenantHeaders(),
      body: JSON.stringify({
        target: 'marketing',
        limit: launchLimit,
        dryRun: false,
        recipientIds: aiSelectedList.map((c) => c.id),
        customContent: { subject: sub, text: txt },
      }),
      retries: 0,
    });
    setSending(false);
    if (getTenantIdClient().trim() !== tenantId) return;
    if (!res.ok) {
      setRunPhase('idle');
      pushToast(res.error || 'Ошибка отправки', 'error');
      return;
    }
    const sent = res.data.sent ?? 0;
    const attempted = res.data.attempted ?? 0;
    const failed = res.data.failed ?? 0;
    writeLastRun({
      tenantId,
      at: new Date().toISOString(),
      target: 'marketing',
      sent,
      attempted,
      failed,
    });
    setLastRun(readLastRun(tenantId));
    setRunPhase('done');
    pushToast(
      failed ? `Отправлено ${sent} из ${attempted}, ошибок: ${failed}` : `Готово: ${sent} из ${attempted}`,
      failed ? 'error' : 'success'
    );
    if (res.data.errors?.length) {
      pushToast(String(res.data.errors[0]).slice(0, 200), 'error');
    }
    void loadMeta();
  }, [
    apiBase,
    tenantId,
    canSendCampaign,
    mailReady,
    aiSelectedList,
    launchLimit,
    letterDraft.subject,
    letterDraft.body,
    loadMeta,
  ]);

  const enterDemo = useCallback(() => {
    setOutreachDemoFlag(true);
    setDemoMode(true);
    setServerCampaign(hydrateOutreachDemoCampaign() as ServerOutreachCampaign);
    setPlanCommitted(false);
    pushToast('Демо: загружен план из outreach-plan-demo.seed.json', 'success');
  }, []);

  const openSlotLetterInQa = useCallback(
    (slot: ServerOutreachSlot) => {
      storeOutreachLetterForQa({
        slotId: slot.id,
        customerName: slot.customerName,
        email: slot.email,
        subject: slot.subject,
        bodyText: slot.bodyText,
      });
      router.push('/qa?from=outreach');
    },
    [router]
  );

  const exitDemo = useCallback(() => {
    setOutreachDemoFlag(false);
    setDemoMode(false);
    pushToast('Демо выключено', 'info');
  }, []);

  return (
    <>
      <CrmPage className="space-y-6 sm:space-y-8 pb-24 sm:pb-28">
        <header className="min-w-0 space-y-3 sm:space-y-4">
          <h1 className="crm-page-h1 flex items-center gap-3 flex-wrap">
            <Megaphone className="w-7 h-7 sm:w-8 sm:h-8 text-[#3b82f6] shrink-0" aria-hidden />
            <span>Рассылка по базе</span>
          </h1>
          <p className="crm-page-lead max-w-3xl">
            Блок <strong className="text-zinc-200 font-medium">«Ход работы»</strong> — шаги 1–2 в{' '}
            <Link href="/settings" className="crm-text-link--amber">
              Настройках ИИ
            </Link>{' '}
            и{' '}
            <Link href="/integrations" className="crm-text-link">
              Интеграциях
            </Link>
            ; дальше отбор контактов и план — в одном разделе ниже (сегменты без ручных фильтров). Ответы — в{' '}
            <Link href="/qa" className="crm-text-link--violet">
              Диалогах ИИ
            </Link>
            .
          </p>
          {!canSendCampaign && !subLoading ? (
            <p className="text-sm text-amber-200/90 rounded-lg border border-amber-500/25 bg-amber-500/10 px-4 py-3 sm:py-3.5 max-w-3xl leading-snug">
              Отправка — с тарифом с интеграциями. Просмотр и черновик доступны.{' '}
              <Link href="/billing" className="crm-text-link--amber font-semibold">
                Тарифы
              </Link>
            </p>
          ) : null}
        </header>

        {demoMode ? (
          <div
            role="status"
            className="rounded-xl border border-violet-500/35 bg-violet-950/30 px-4 py-4 sm:px-5 sm:py-4 text-[13px] text-violet-100/95 space-y-3 leading-relaxed"
          >
            <p className="font-semibold text-white text-sm">Демо-режим: превью сгенерированного плана</p>
            <p className="text-[#c4b5fd]">
              Данные взяты из сида{' '}
              <code className="rounded bg-[#1f1f22] px-1.5 py-0.5 text-[11px] text-zinc-300">
                src/fixtures/outreach-plan-demo.seed.json
              </code>{' '}
              (копия:{' '}
              <a
                href="/fixtures/outreach-plan-demo.seed.json"
                target="_blank"
                rel="noreferrer"
                className="crm-text-link font-medium"
              >
                /fixtures/outreach-plan-demo.seed.json
              </a>
              ). Запуск: откройте{' '}
              <code className="rounded bg-[#1f1f22] px-1.5 py-0.5 text-[11px] text-zinc-300">/outreach?demo=1</code>
              . API-операции отключены.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <button type="button" onClick={exitDemo} className={cn('crm-btn', 'crm-btn--sm', 'crm-btn--secondary')}>
                Выключить демо
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 py-1">
            <button type="button" onClick={enterDemo} className={cn('crm-btn', 'crm-btn--sm', 'crm-btn--secondary')}>
              Превью: демо-план (без API)
            </button>
            <span className="text-xs text-[#71717a]">или URL с параметром demo=1</span>
          </div>
        )}

        {/* Ход работы */}
        <section className="crm-panel p-5 sm:p-6 space-y-6 sm:space-y-7">
          <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
            <h2 className="crm-section-head flex items-center gap-2">
              <Target className="w-4 h-4 text-[#3b82f6] shrink-0" aria-hidden />
              Ход работы (по шагам)
            </h2>
            <div className="flex flex-wrap gap-2 justify-end">
              <button
                type="button"
                disabled={settingsBusy || (metaLoading && !useMockOutreach)}
                onClick={() => void refreshFromSettings()}
                className={cn('crm-btn', 'crm-btn--sm', 'crm-btn--secondary', 'shrink-0')}
              >
                {settingsBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Обновить
              </button>
              <Link
                href="/settings"
                className={cn('crm-btn', 'crm-btn--sm', 'crm-btn--secondary', 'shrink-0')}
              >
                <Settings className="w-3.5 h-3.5" />
                ИИ
              </Link>
              <Link
                href="/integrations"
                className={cn('crm-btn', 'crm-btn--sm', 'crm-btn--secondary', 'shrink-0')}
              >
                SMTP
              </Link>
            </div>
          </div>
          <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
            {workflowSteps.map((step, idx) => (
              <div
                key={step.id}
                className={cn(
                  'flex gap-3 sm:gap-4 rounded-[10px] border p-4 sm:p-5 min-h-0',
                  step.ok ? 'border-emerald-500/25 bg-emerald-950/10' : 'border-[#1f1f22] bg-[#0a0a0c]'
                )}
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1f1f22] text-[10px] font-bold text-zinc-400">
                  {idx + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    {step.ok ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <Circle className="w-3.5 h-3.5 text-[#52525b] shrink-0 mt-0.5" />
                    )}
                    <span className="text-[13px] font-semibold text-white leading-snug">{step.title}</span>
                  </div>
                  <ul className="mt-3 space-y-2 text-[12px] text-[#a1a1aa] leading-relaxed list-disc pl-3.5 marker:text-[#52525b]">
                    {step.lines.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
          {runPhase === 'sending' ? (
            <div className="rounded-lg border border-sky-500/30 bg-sky-950/20 px-4 py-3 sm:px-4 sm:py-3.5">
              <div className="flex items-center gap-2.5 text-[12px] text-sky-200">
                <Loader2 className="w-4 h-4 animate-spin" />
                Мгновенная рассылка…
              </div>
              <div className="mt-3 h-1 rounded-full bg-[#1f1f22] overflow-hidden">
                <div className="h-full w-3/5 bg-sky-500 rounded-full animate-pulse" />
              </div>
            </div>
          ) : null}
          {runPhase === 'done' && lastRun ? (
            <div className="rounded-lg border border-emerald-500/35 bg-emerald-950/20 px-4 py-3 sm:py-3.5 text-[12px] text-emerald-200 leading-relaxed">
              Мгновенная отправка: {lastRun.sent} из {lastRun.attempted}
              {lastRun.failed ? ` · ошибок: ${lastRun.failed}` : ''}
            </div>
          ) : null}
        </section>

        {/* План, аудитория (авто), матрица */}
        <section className="crm-panel p-5 sm:p-6 space-y-6 sm:space-y-7">
          <div className="flex flex-wrap items-start justify-between gap-4 sm:gap-5">
            <div className="min-w-0 flex-1">
              <h2 className="crm-section-head flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-[#8b5cf6] shrink-0" aria-hidden />
                План и рассылка
              </h2>
              <p className="crm-section-note max-w-2xl">
                Отбор контактов и персонализация — по скорингу и ИИ. Матрица: окно времени, лимиты, строки по людям;
                текст письма — по клику на строку.
              </p>
            </div>
            <button
              type="button"
              disabled={
                generatePlanBusy ||
                serverCampaign?.status === 'running' ||
                launchInfo.exhausted ||
                (!useMockOutreach && (!canSendCampaign || aiSelectedList.length === 0)) ||
                (metaLoading && !useMockOutreach)
              }
              onClick={() => void generateOutreachPlan()}
              className={cn('crm-btn', 'crm-btn--primary', 'shrink-0')}
            >
              {generatePlanBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              Сгенерировать план
            </button>
          </div>

          <div className="rounded-[10px] border border-[#27272a] bg-[#0a0a0c] p-5 sm:p-6 space-y-6">
            {(localAutoPreview || forceLocalPlan) && !demoMode ? (
              <p className="text-[13px] text-sky-100/95 leading-relaxed rounded-lg border border-sky-500/25 bg-sky-950/20 px-4 py-3.5">
                <strong className="text-white">Локальное превью.</strong> В расчёт подмешаны демо-клиенты из сида;
                отправки не выполняются. «Сгенерировать план» собирает матрицу в браузере (без ИИ и API).
                {forceLocalPlan ? (
                  <span className="block mt-2 text-[12px] text-sky-200/85">
                    Режим по умолчанию:{' '}
                    <code className="rounded bg-[#1f1f22] px-1.5 py-0.5 text-[11px] text-zinc-300">
                      NEXT_PUBLIC_OUTREACH_FORCE_LOCAL_PLAN
                    </code>{' '}
                    ≠ <code className="rounded bg-[#1f1f22] px-1.5 py-0.5 text-[11px] text-zinc-300">0</code>. Полная
                    отправка — установите переменную в <code className="text-[11px]">0</code> и настройте SMTP.
                  </span>
                ) : null}
              </p>
            ) : null}

            {launchInfo.exhausted ? (
              <p className="text-[13px] text-amber-200/95 leading-relaxed rounded-lg border border-amber-500/25 bg-amber-950/20 px-4 py-3">
                Лимиты тарифа не позволяют запустить кампанию (закончились сообщения или квота аудитории). Обновите тариф
                или данные на странице «Мой тариф».
              </p>
            ) : null}

            {slotsTotal > 0 ? (
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-950/15 p-4 sm:p-5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-200/90 flex items-center gap-2 mb-4">
                  <Database className="w-4 h-4 shrink-0 opacity-90" aria-hidden />
                  Лимиты по подписке
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                  <div className="rounded-lg border border-[#1f1f22] bg-[#0a0a0c] px-4 py-3.5 min-h-[5.5rem] flex flex-col justify-center">
                    <p className="text-[10px] uppercase tracking-wide text-[#71717a] mb-1">Макс. на запуск</p>
                    <p className="text-2xl sm:text-[1.65rem] font-semibold text-white tabular-nums leading-none tracking-tight">
                      {launchLimit}
                    </p>
                  </div>
                  <div className="rounded-lg border border-[#1f1f22] bg-[#0a0a0c] px-4 py-3.5 min-h-[5.5rem] flex flex-col justify-center">
                    <p className="text-[10px] uppercase tracking-wide text-[#71717a] mb-1">Сообщения (остаток)</p>
                    <p className="text-2xl sm:text-[1.65rem] font-semibold text-zinc-200 tabular-nums leading-none tracking-tight">
                      {launchInfo.messagesLeft}
                    </p>
                  </div>
                  <div className="rounded-lg border border-[#1f1f22] bg-[#0a0a0c] px-4 py-3.5 min-h-[5.5rem] flex flex-col justify-center">
                    <p className="text-[10px] uppercase tracking-wide text-[#71717a] mb-1">Аудитория (запас)</p>
                    <p className="text-2xl sm:text-[1.65rem] font-semibold text-zinc-200 tabular-nums leading-none tracking-tight">
                      {launchInfo.audienceHeadroom}
                    </p>
                  </div>
                </div>
                <p className="mt-4 text-[12px] text-[#71717a] leading-relaxed">
                  В матрице сейчас{' '}
                  <span className="text-white font-semibold tabular-nums">{serverCampaign?.slots.length ?? 0}</span> контактов
                  (не больше 500 и не больше лимитов тарифа).
                </p>
              </div>
            ) : (
              <p className="text-[12px] text-[#71717a] leading-relaxed max-w-3xl">
                До нажатия «Сгенерировать план» число лимита не показываем: оно считается автоматически из подписки
                (остаток сообщений и свободные слоты аудитории, не больше 500). Отбор в выборку уже идёт по этим
                правилам; точное значение и фактический размер матрицы появятся ниже после генерации.
              </p>
            )}

            <div className="space-y-4 min-w-0">
              <p className="text-[12px] text-[#71717a] leading-relaxed">
                Отбор: сначала удержание, затем дозаполнение с согласием.{' '}
                <Link href="/clients" className="crm-text-link whitespace-nowrap">
                  Все клиенты
                </Link>
              </p>
              <dl className="flex w-full min-w-0 flex-row flex-nowrap gap-2 min-[420px]:gap-3 sm:gap-3">
                <div className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col justify-center rounded-xl border border-[#27272a] bg-[#121214] px-2 py-3 min-[420px]:px-3 sm:px-4 sm:py-3.5">
                  <dt className="text-[9px] min-[420px]:text-[10px] uppercase tracking-wide text-[#71717a] leading-tight mb-1">
                    База
                  </dt>
                  <dd className="text-lg min-[420px]:text-xl sm:text-2xl font-semibold tabular-nums text-white leading-none tracking-tight">
                    {clientsForOutreach.length}
                  </dd>
                  {useMockOutreach && clients.length < clientsForOutreach.length ? (
                    <p className="text-[9px] text-[#52525b] mt-1.5 leading-snug line-clamp-2">
                      CRM {clients.length} + демо {clientsForOutreach.length - clients.length}
                    </p>
                  ) : null}
                </div>
                <div className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col justify-center rounded-xl border border-[#27272a] bg-[#121214] px-2 py-3 min-[420px]:px-3 sm:px-4 sm:py-3.5">
                  <dt className="text-[9px] min-[420px]:text-[10px] uppercase tracking-wide text-[#71717a] leading-tight mb-1">
                    Согласие
                  </dt>
                  <dd className="text-lg min-[420px]:text-xl sm:text-2xl font-semibold tabular-nums text-zinc-200 leading-none tracking-tight">
                    {marketingEligible}
                  </dd>
                </div>
                <div className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col justify-center rounded-xl border border-[#27272a] bg-[#121214] px-2 py-3 min-[420px]:px-3 sm:px-4 sm:py-3.5">
                  <dt className="text-[9px] min-[420px]:text-[10px] uppercase tracking-wide text-[#71717a] leading-tight mb-1">
                    Удержание
                  </dt>
                  <dd className="text-lg min-[420px]:text-xl sm:text-2xl font-semibold tabular-nums text-zinc-200 leading-none tracking-tight">
                    {retentionEligible}
                  </dd>
                </div>
                <div className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col justify-center rounded-xl border border-[#27272a] bg-[#121214] px-2 py-3 min-[420px]:px-3 sm:px-4 sm:py-3.5">
                  <dt className="text-[9px] min-[420px]:text-[10px] uppercase tracking-wide text-[#71717a] leading-tight mb-1">
                    В выборку
                  </dt>
                  <dd className="text-lg min-[420px]:text-xl sm:text-2xl font-semibold tabular-nums text-white leading-none tracking-tight">
                    {aiSelectedList.length}
                  </dd>
                </div>
              </dl>
              {aiSelectedList.length > 0 ? (
                <div className="rounded-xl border border-[#27272a] bg-[#121214] max-h-48 overflow-y-auto custom-scrollbar shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]">
                  <ul className="divide-y divide-[#1f1f22]">
                    {aiSelectedList.slice(0, 12).map((c, idx) => {
                      const { primary, secondary, messengers } = outreachClientContactLines(c);
                      const contactLine = [primary, secondary, ...messengers].filter(Boolean).join(' · ');
                      return (
                        <li
                          key={c.id}
                          className="flex min-h-[2.75rem] items-center gap-4 py-2.5 pl-5 pr-4 sm:gap-5 sm:pl-6 sm:pr-5"
                        >
                          <span className="w-8 shrink-0 text-right text-[12px] font-semibold tabular-nums text-[#52525b] sm:w-9">
                            {idx + 1}.
                          </span>
                          <span
                            className="flex-1 min-w-0 text-[#e4e4e7] font-medium text-[13px] truncate"
                            title={c.name}
                          >
                            {c.name}
                          </span>
                          <span
                            className="shrink-0 min-w-0 max-w-[42%] sm:max-w-[46%] font-mono text-[11px] text-[#a1a1aa] truncate text-right"
                            title={contactLine}
                          >
                            {contactLine}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  {aiSelectedList.length > 12 ? (
                    <p className="border-t border-[#1f1f22] py-2.5 pl-5 pr-4 text-[11px] text-[#52525b] sm:pl-6 sm:pr-5">
                      и ещё {aiSelectedList.length - 12}…
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
          {serverCampaign ? (
            <div className="space-y-4 sm:space-y-5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[12px] rounded-lg border border-[#27272a] bg-[#0a0a0c]/70 px-3.5 py-2.5 sm:px-4 sm:py-3">
                <span
                  className={cn(
                    'rounded-md px-2.5 py-1 text-[11px] font-semibold tracking-tight',
                    serverCampaign.status === 'running' && 'bg-emerald-500/20 text-emerald-200',
                    serverCampaign.status === 'draft' && 'bg-zinc-500/20 text-zinc-200',
                    serverCampaign.status === 'paused' && 'bg-amber-500/20 text-amber-200',
                    serverCampaign.status === 'completed' && 'bg-sky-500/20 text-sky-200'
                  )}
                >
                  {serverCampaign.status === 'draft' && 'Черновик'}
                  {serverCampaign.status === 'running' && 'Идёт отправка'}
                  {serverCampaign.status === 'paused' && 'Пауза'}
                  {serverCampaign.status === 'completed' && 'Завершено'}
                </span>
                <span className="text-[#71717a] leading-relaxed">
                  <span className="tabular-nums text-zinc-400">{serverCampaign.slots.length}</span> слотов ·{' '}
                  <span className="tabular-nums text-zinc-400">
                    {serverCampaign.slots.filter((s) => s.status === 'sent').length}
                  </span>{' '}
                  отправлено ·{' '}
                  <span className="tabular-nums text-zinc-400">
                    {serverCampaign.slots.filter((s) => s.status === 'pending').length}
                  </span>{' '}
                  в очереди
                </span>
              </div>
              {mailingStripVisible ? (
                <div className="rounded-xl border border-[#27272a] bg-[#0a0a0c] px-5 py-4 sm:px-6 sm:py-5">
                  <div className="flex flex-col gap-5">
                    <div className="flex items-start gap-3 pb-4 border-b border-[#1f1f22]">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#121214] border border-[#27272a]">
                        <Mails className="w-4 h-4 text-[#a1a1aa]" aria-hidden />
                      </div>
                      <div className="min-w-0 pt-0.5">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-300">
                          Рассылка в работе
                        </p>
                        <p className="text-[12px] text-[#71717a] mt-1 leading-snug">
                          Активные каналы и прогресс по слотам этой кампании.
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#71717a]">
                        Каналы
                      </p>
                      <p
                        className={cn(
                          'text-[13px] sm:text-[14px] leading-relaxed break-words',
                          mailingChannelsLabel === 'каналы не подключены'
                            ? 'text-[#71717a]'
                            : 'text-zinc-100 font-medium'
                        )}
                      >
                        {mailingChannelsLabel}
                      </p>
                    </div>
                    <dl className="flex w-full min-w-0 flex-row flex-nowrap gap-3 pt-1">
                      <div className="flex min-w-0 flex-1 basis-0 flex-col rounded-lg border border-[#1f1f22] bg-[#121214]/90 px-3 py-3 sm:px-4 sm:py-3.5">
                        <dt className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#71717a]">
                          Отправлено
                        </dt>
                        <dd className="text-xl font-semibold tabular-nums leading-none tracking-tight text-zinc-100 sm:text-2xl">
                          {slotsSent}
                        </dd>
                      </div>
                      <div className="flex min-w-0 flex-1 basis-0 flex-col rounded-lg border border-[#1f1f22] bg-[#121214]/90 px-3 py-3 sm:px-4 sm:py-3.5">
                        <dt className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#71717a]">
                          В очереди
                        </dt>
                        <dd className="text-xl font-semibold tabular-nums leading-none tracking-tight text-zinc-100 sm:text-2xl">
                          {slotsPending}
                        </dd>
                      </div>
                      <div className="flex min-w-0 flex-1 basis-0 flex-col rounded-lg border border-[#1f1f22] bg-[#121214]/90 px-3 py-3 sm:px-4 sm:py-3.5">
                        <dt className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#71717a]">
                          Всего слотов
                        </dt>
                        <dd className="text-xl font-semibold tabular-nums leading-none tracking-tight text-zinc-100 sm:text-2xl">
                          {slotsTotal}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>
              ) : null}
              {scheduleSummary ? (
                <div className="rounded-[10px] border border-[#1f1f22] bg-[#0a0a0c] p-4 sm:p-6 space-y-4 text-[13px] text-[#a1a1aa]">
                  <p className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wide">
                    Параметры плана рассылки
                  </p>
                  <ul className="space-y-2.5 list-disc pl-4 leading-relaxed marker:text-[#52525b]">
                    <li>
                      Получателей:{' '}
                      <span className="text-zinc-200 tabular-nums">{scheduleSummary.recipientCount}</span>
                    </li>
                    <li>
                      Окно отправок:{' '}
                      <span className="text-zinc-200">
                        {scheduleSummary.windowStart.toLocaleString('ru-RU', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        —{' '}
                        {scheduleSummary.windowEnd.toLocaleString('ru-RU', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </li>
                    <li>
                      Оценка: ~{' '}
                      <span className="text-zinc-200 tabular-nums">
                        {scheduleSummary.approxPerDay.toFixed(1)}
                      </span>{' '}
                      писем в сутки в среднем (равномерно по окну)
                    </li>
                    <li>
                      Ритм по настройкам ИИ:{' '}
                      <span className="text-zinc-200">{scheduleSummary.cadenceLabel}</span>
                    </li>
                  </ul>
                </div>
              ) : null}

              <div className="rounded-xl border border-[#27272a] bg-[#0a0a0c] p-4 sm:p-6 space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex gap-3 min-w-0">
                    <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2.5 shrink-0">
                      <Tag className="w-5 h-5 text-amber-300" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-white leading-snug">
                        Акции, промокоды и скидки в этой кампании
                      </h3>
                      <p className="text-[12px] text-[#71717a] mt-1 leading-relaxed">
                        Это активные данные из «Настройки ИИ» — они попадают в тело письма вместе с персонализацией.
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/settings"
                    className="text-[12px] font-semibold text-sky-400 hover:text-sky-300 shrink-0"
                  >
                    Редактировать →
                  </Link>
                </div>
                {outreachOffersSummary.promos.length === 0 &&
                outreachOffersSummary.discs.length === 0 ? (
                  <p className="text-[13px] text-[#71717a] rounded-lg border border-dashed border-[#333336] px-3 py-3">
                    Активных акций и промокодов нет — добавьте их в «Настройки ИИ», затем нажмите «Обновить» в блоке «Ход
                    работы».
                  </p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {outreachOffersSummary.promos.length > 0 ? (
                      <div className="rounded-lg border border-[#1f1f22] bg-[#121214] p-3 space-y-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#71717a] flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-amber-400" aria-hidden />
                          Акции
                        </p>
                        <ul className="space-y-2">
                          {outreachOffersSummary.promos.map((p) => (
                            <li key={p.id} className="text-[12px] text-[#d4d4d8] leading-snug">
                              <span className="font-medium text-white">{p.title}</span>
                              {p.body ? <span className="text-[#a1a1aa]"> — {p.body}</span> : null}
                              {p.validUntil ? (
                                <span className="block text-[11px] text-[#52525b] mt-0.5">до {p.validUntil}</span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {outreachOffersSummary.discs.length > 0 ? (
                      <div className="rounded-lg border border-[#1f1f22] bg-[#121214] p-3 space-y-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#71717a] flex items-center gap-1.5">
                          <Percent className="w-3.5 h-3.5 text-emerald-400" aria-hidden />
                          Промокоды
                        </p>
                        <ul className="space-y-2">
                          {outreachOffersSummary.discs.map((d) => (
                            <li key={d.id} className="text-[12px] text-[#d4d4d8]">
                              <span className="font-mono text-emerald-300/95">{d.code}</span>
                              <span className="text-[#a1a1aa]">
                                {' '}
                                — {d.percent}% {d.description ? `· ${d.description}` : ''}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2 text-[12px] text-[#a1a1aa] rounded-lg bg-[#121214]/80 border border-[#1f1f22] px-3 py-2">
                  <span className="text-[#71717a]">Лимит скидки по правилам бренда:</span>
                  <span className="tabular-nums font-semibold text-zinc-200">{outreachOffersSummary.maxPct}%</span>
                </div>
                {outreachOffersSummary.activeAutos.length > 0 ? (
                  <div className="text-[12px] text-[#71717a]">
                    <span className="font-semibold text-zinc-400">Активные сценарии: </span>
                    {outreachOffersSummary.activeAutos.map((a) => a.name).join(', ')}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
                <p className="text-[12px] text-[#a1a1aa] leading-relaxed order-2 sm:order-1 min-w-0 space-y-1.5">
                  {!planCommitted ? (
                    <>
                      <span className="block text-[#d4d4d8]">
                        Таблица ниже — тот же план: контакты, время отправки, тема и статус по каждому слоту. Это
                        черновик в интерфейсе, пока вы его не сохраните.
                      </span>
                      <span className="block text-amber-200/95 font-medium">
                        Сначала «Сохранить» — зафиксировать план, затем «Запуск» — начать рассылку по расписанию.
                      </span>
                    </>
                  ) : serverCampaign.status === 'running' ? (
                    <span className="text-emerald-200/90">
                      Рассылка идёт по сохранённому плану. При необходимости поставьте на паузу.
                    </span>
                  ) : serverCampaign.status === 'completed' ? (
                    <span className="text-sky-200/90">
                      По этому плану рассылка завершена. При необходимости сгенерируйте новый план.
                    </span>
                  ) : (
                    <>
                      <span className="block text-[#d4d4d8]">
                        План сохранён — строки в таблице соответствуют тому, что уйдёт в очередь отправки.
                      </span>
                      <span className="block text-emerald-200/95 font-medium">
                        Нажмите «Запуск», чтобы начать рассылку по расписанию (если есть слоты в очереди и подключены
                        каналы).
                      </span>
                    </>
                  )}
                </p>
                <div className="flex flex-wrap items-center justify-end gap-2 order-1 sm:order-2 w-full sm:w-auto">
                  {serverCampaign.status === 'running' ? (
                    <button
                      type="button"
                      disabled={schedulePauseBusy}
                      onClick={() => void pauseScheduledOutreach()}
                      className={cn('crm-btn', 'crm-btn--sm', 'crm-btn--warn', 'shrink-0')}
                    >
                      {schedulePauseBusy ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Pause className="w-3.5 h-3.5" />
                      )}
                      Пауза
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={
                        scheduleStartBusy ||
                        !planCommitted ||
                        (!useMockOutreach && (!canSendCampaign || !mailReady)) ||
                        serverCampaign.status === 'completed' ||
                        serverCampaign.slots.filter((s) => s.status === 'pending').length === 0
                      }
                      onClick={() => void startScheduledOutreach()}
                      className={cn(
                        'crm-btn',
                        'crm-btn--sm',
                        'crm-btn--success',
                        'shrink-0',
                        !planCommitted && 'opacity-40 cursor-not-allowed'
                      )}
                    >
                      {scheduleStartBusy ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Play className="w-3.5 h-3.5" />
                      )}
                      Запуск
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={
                      savePlanBusy || serverCampaign.status === 'running' || serverCampaign.status === 'completed'
                    }
                    onClick={() => void saveOutreachPlan()}
                    className={cn(
                      'crm-btn',
                      'crm-btn--sm',
                      'shrink-0',
                      'border border-amber-500/50 bg-amber-500/[0.08] text-amber-100',
                      'hover:bg-amber-500/15 hover:border-amber-400/55',
                      'disabled:opacity-40 disabled:pointer-events-none'
                    )}
                  >
                    {savePlanBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Сохранить
                  </button>
                </div>
              </div>
              <div className="rounded-[10px] border border-[#27272a] bg-[#0a0a0c] overflow-hidden">
                <div className="max-h-[22rem] overflow-x-auto overflow-y-auto custom-scrollbar">
                  <table className="w-full min-w-[640px] text-left text-[12px]">
                    <thead className="sticky top-0 bg-[#121214] border-b border-[#27272a] text-[#71717a] z-10">
                      <tr>
                        <th className="px-3 py-3 font-medium w-10" aria-label="Готово" />
                        <th className="px-3 py-3 font-medium">Контакт</th>
                        <th className="px-3 py-3 font-medium whitespace-nowrap">Время отправки</th>
                        <th className="px-3 py-3 font-medium min-w-[8rem]">Тема (кратко)</th>
                        <th className="px-3 py-3 font-medium whitespace-nowrap">Статус</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1f1f22]">
                      {serverCampaign.slots.map((s) => (
                        <tr
                          key={s.id}
                          className="text-[#a1a1aa] hover:bg-[#141416]/60 transition-colors"
                        >
                          <td className="px-3 py-2.5 align-middle text-center">
                            {s.status === 'sent' ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" aria-label="Отправлено" />
                            ) : s.status === 'failed' || s.status === 'skipped_limit' ? (
                              <AlertCircle
                                className={cn(
                                  'w-4 h-4 mx-auto',
                                  s.status === 'failed' ? 'text-red-400' : 'text-amber-400'
                                )}
                                aria-label={slotStatusLabel(s.status)}
                              />
                            ) : (
                              <Circle className="w-4 h-4 text-[#3f3f46] mx-auto" aria-label="Ожидает" />
                            )}
                          </td>
                          <td className="px-3 py-2.5 align-top min-w-0 max-w-[200px]">
                            <div className="text-[#e4e4e7] font-medium truncate">{s.customerName}</div>
                            <div className="font-mono text-[11px] text-[#52525b] truncate">{s.email}</div>
                            {s.personalizedByAi ? (
                              <span className="text-[9px] text-violet-400">персонализация ИИ</span>
                            ) : null}
                          </td>
                          <td className="px-3 py-2.5 align-top tabular-nums text-[#d4d4d8] whitespace-nowrap">
                            {new Date(s.scheduledAt).toLocaleString('ru-RU', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="px-3 py-2.5 align-top min-w-0 max-w-[16rem]">
                            <span className="line-clamp-2 text-[#d4d4d8] block">{s.subject}</span>
                            <button
                              type="button"
                              onClick={() => openSlotLetterInQa(s)}
                              className="mt-1.5 text-left text-[11px] font-semibold text-violet-400 hover:text-violet-300 underline-offset-2 hover:underline"
                            >
                              Открыть текст в «Диалогах ИИ» →
                            </button>
                          </td>
                          <td className="px-3 py-2.5 align-top whitespace-nowrap">
                            <span
                              className={cn(
                                s.status === 'sent' && 'text-emerald-400',
                                s.status === 'pending' && 'text-zinc-400',
                                s.status === 'failed' && 'text-red-400',
                                s.status === 'skipped_limit' && 'text-amber-400'
                              )}
                            >
                              {slotStatusLabel(s.status)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[#52525b] leading-relaxed max-w-2xl">
              Завершите шаги 1–2, затем «Сгенерировать план». База для ИИ подтягивается из «Настройки ИИ» и
              сценариев; итог по каждому контакту — в строке таблицы.
            </p>
          )}
        </section>

        {/* Действия внизу */}
        <section className="crm-panel p-4 sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-stretch sm:justify-between sm:gap-6">
            <div className="min-w-0 space-y-3 flex-1">
              <div className="rounded-lg border border-[#27272a] bg-[#0a0a0c]/80 px-3.5 py-3 sm:px-4 sm:py-3.5">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[#71717a]">Каналы</p>
                    {mailReady ? (
                      <p className="text-[13px] sm:text-[14px] text-zinc-100 font-medium leading-relaxed break-words">
                        {mailingChannelsLabel}
                      </p>
                    ) : (
                      <p className="text-[13px] text-amber-200/90 leading-snug">
                        Подключите Email в интеграциях.
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => void loadMeta()}
                    disabled={metaLoading}
                    className={cn(
                      'crm-btn',
                      'crm-btn--sm',
                      'crm-btn--secondary',
                      'crm-btn--icon',
                      'text-[#38bdf8]',
                      'shrink-0'
                    )}
                    aria-label="Обновить статус каналов"
                  >
                    <RefreshCw className={cn('w-3.5 h-3.5', metaLoading && 'animate-spin')} />
                  </button>
                </div>
              </div>
              <Link
                href="/qa"
                className="inline-flex items-center gap-1.5 text-[13px] font-semibold crm-text-link--violet w-fit"
              >
                <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                Диалоги ИИ
              </Link>
              <p className="text-xs text-[#52525b] max-w-xl leading-relaxed">
                План по расписанию — основной режим. «Мгновенно» — один текст на всю текущую выборку.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-start sm:justify-end gap-2 shrink-0 sm:items-end sm:pt-1">
              <button
                type="button"
                disabled={verifying || (!useMockOutreach && (!canSendCampaign || aiSelectedList.length === 0))}
                onClick={() => void verifyWithServer()}
                className={cn('crm-btn', 'crm-btn--sm', 'crm-btn--secondary')}
              >
                {verifying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FlaskConical className="w-3.5 h-3.5" />}
                Проверить
              </button>
              <button
                type="button"
                disabled={
                  sending ||
                  metaLoading ||
                  (!useMockOutreach &&
                    (!canSendCampaign || !mailReady || aiSelectedList.length === 0 || !letterReady))
                }
                onClick={() => void sendCampaign()}
                className={cn(
                  'crm-btn',
                  'crm-btn--sm',
                  useMockOutreach ||
                    (canSendCampaign &&
                      mailReady &&
                      aiSelectedList.length > 0 &&
                      letterReady &&
                      !metaLoading)
                    ? 'crm-btn--primary'
                    : 'crm-btn--secondary'
                )}
              >
                {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Мгновенно
              </button>
            </div>
          </div>
        </section>

        {lastRun && lastRun.failed > 0 ? (
          <p className="text-sm text-amber-200/90 flex items-start gap-2 max-w-2xl">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            Часть писем не доставлена — проверьте SMTP и логи.
          </p>
        ) : null}
      </CrmPage>

    </>
  );
}
