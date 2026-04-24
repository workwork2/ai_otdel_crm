import { randomUUID } from 'crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import {
  appendBrainOffersToMail,
  filterCustomersForEmailCampaign,
  plainTextToRetentionHtml,
  type RetentionTarget,
} from '../mail/retention-audience';
import { MailService } from '../mail/mail.service';
import { getTenantSmtpFromWorkspace } from '../integrations/integration-helpers';
import { entitlementsForPlan } from '../subscription/plan-entitlements';
import { subscriptionWindowFromValidUntil } from '../subscription/subscription-dates';
import { StoreService } from '../store/store.service';
import type {
  JsonRecord,
  TenantOutreachCampaign,
  TenantOutreachSlot,
  TenantWorkspace,
} from '../store/store.types';

const MAX_RECIPIENTS = 500;
const MAX_AI_PERSONAL = 24;
const TICK_MS = 45_000;

function cadenceSpanDays(raw: unknown): number {
  const c = String(raw ?? 'week').trim();
  if (c === '14d') return 14;
  if (c === 'month') return 30;
  return 7;
}

function parseSubjectBody(raw: string): { subject: string; body: string } {
  const t = raw.trim();
  const sm = t.match(/ТЕМА:\s*([^\n]+)/i);
  const bm = t.match(/ТЕКСТ:\s*([\s\S]+)/i);
  if (sm?.[1] && bm?.[1]) {
    return { subject: sm[1].trim().slice(0, 300), body: bm[1].trim().slice(0, 50_000) };
  }
  return { subject: 'Письмо', body: t.slice(0, 50_000) };
}

function mergeName(subject: string, body: string, name: string): { subject: string; body: string } {
  const sub = subject
    .replace(/\{\{name\}\}/gi, name)
    .replace(/\{\{имя\}\}/gi, name);
  const bod = body
    .replace(/\{\{name\}\}/gi, name)
    .replace(/\{\{имя\}\}/gi, name);
  return { subject: sub, body: bod };
}

function customerHint(c: JsonRecord): string {
  const sc = c.scoring as { churnSegment?: string; lifecycle?: string } | undefined;
  const parts: string[] = [];
  if (sc?.churnSegment) parts.push(`сегмент: ${sc.churnSegment}`);
  if (sc?.lifecycle) parts.push(`жизненный цикл: ${sc.lifecycle}`);
  const city = String((c as { city?: string }).city ?? '').trim();
  if (city) parts.push(`город: ${city}`);
  return parts.join('; ') || 'без доп. тегов в CRM';
}

@Injectable()
export class OutreachService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(OutreachService.name);
  private tickTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly store: StoreService,
    private readonly ai: AiService,
    private readonly mail: MailService
  ) {}

  onModuleInit() {
    this.tickTimer = setInterval(() => {
      void this.tickAllTenants();
    }, TICK_MS);
  }

  onModuleDestroy() {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  getCampaignView(tenantId: string) {
    const w = this.store.getTenantWorkspace(tenantId);
    const c = w.outreachCampaign;
    return {
      campaign: c ?? null,
      messagesUsed: w.billing.messagesUsed,
      messagesLimit: w.billing.messagesLimit,
    };
  }

  private workspaceForScheduledSends(tenantId: string): TenantWorkspace {
    const w = this.store.getTenantWorkspace(tenantId);
    if (!entitlementsForPlan(w.billing.planKey).integrationsManage) {
      throw new ForbiddenException(
        'Управление интеграциями и почтовыми рассылками недоступно на текущем тарифе'
      );
    }
    const emailRow = w.integrations.find((i) => i.name === 'Email');
    if (!emailRow || emailRow.status !== 'connected') {
      throw new ForbiddenException('Подключите канал Email в разделе интеграций');
    }
    const tenantSmtp = getTenantSmtpFromWorkspace(w);
    if (!this.mail.isConfigured() && !this.mail.isTenantSmtpConfigured(tenantSmtp)) {
      throw new BadRequestException(
        'Укажите SMTP в настройках интеграции «Email» или задайте SMTP_HOST, SMTP_USER, SMTP_PASS в окружении API'
      );
    }
    return w;
  }

  async generateCampaign(
    tenantId: string,
    body: {
      target?: RetentionTarget;
      recipientIds?: string[];
      baseSubject?: string;
      baseBodyText?: string;
    }
  ) {
    const w = this.store.getTenantWorkspace(tenantId);
    if (w.outreachCampaign?.status === 'running') {
      throw new BadRequestException('Сначала приостановите текущую рассылку');
    }
    const target: RetentionTarget = body?.target === 'marketing' ? 'marketing' : 'retention';
    const ids = Array.isArray(body?.recipientIds) ? body.recipientIds.map((x) => String(x)) : [];
    if (ids.length === 0) {
      throw new BadRequestException('Укажите хотя бы одного получателя (recipientIds)');
    }
    if (ids.length > MAX_RECIPIENTS) {
      throw new BadRequestException(`Не больше ${MAX_RECIPIENTS} получателей за раз`);
    }

    const allowed = new Set(
      filterCustomersForEmailCampaign(w.customers, target).map((r) => r.id)
    );
    for (const id of ids) {
      if (!allowed.has(id)) {
        throw new BadRequestException(
          `Получатель ${id} не входит в сегмент или не подходит для рассылки (согласие, email, сегмент)`
        );
      }
    }

    const baseSubject = String(body?.baseSubject ?? '').trim().slice(0, 300);
    const baseBodyText = String(body?.baseBodyText ?? '').trim().slice(0, 50_000);
    if (baseSubject.length < 2 || baseBodyText.length < 4) {
      throw new BadRequestException('Заполните базовую тему и текст письма (как в черновике)');
    }

    const master = this.store.getSnapshot().super.masterPrompt;
    const brain = w.brain as {
      systemPrompt?: string;
      brandVoicePrompt?: string;
      tone?: number;
      useEmoji?: boolean;
      spamCadence?: string;
      maxDiscountPercent?: number;
    };
    const useAi = entitlementsForPlan(w.billing.planKey).aiRefineCopy;
    const snap = this.store.getSnapshot();
    const cadence = cadenceSpanDays(brain.spamCadence);

    let planText: string;
    if (useAi) {
      const system = [
        master,
        brain.systemPrompt ? `Правила воркспейса:\n${brain.systemPrompt}` : '',
        'Ты маркетолог B2C. Дай короткий план email-кампании на русском: 5–7 пунктов Markdown (заголовки ## или нумерация).',
        'Учти ритм касаний и без спама. Не придумывай фактов о клиентах.',
      ]
        .filter(Boolean)
        .join('\n\n');
      const user = [
        `Сегмент: ${target === 'marketing' ? 'все с маркетинговым согласием' : 'удержание (риск оттока)'}.`,
        `Получателей: ${ids.length}. Разнос отправок: примерно ${cadence} дн.`,
        `Базовая тема: ${baseSubject}`,
        `Фрагмент текста: ${baseBodyText.slice(0, 900)}`,
      ].join('\n');
      const out = await this.ai.completeText({ system, user, maxTokens: 1200 });
      planText =
        out.text?.trim() ||
        `## План\n1. Проверить текст и акции.\n2. Разнести отправки на ${cadence} дн.\n3. Отслеживать ответы в QA.`;
      if (out.error) {
        this.log.warn(`generate plan AI: ${out.error}`);
      }
    } else {
      planText = `## План рассылки\n1. Проверьте тему и текст.\n2. Отправки разнесены по расписанию (~${cadence} дн.).\n3. Персонализация — подстановка имени (ИИ недоступен на тарифе).`;
    }

    const byId = new Map(w.customers.map((c) => [String((c as { id?: string }).id ?? ''), c]));
    const now = Date.now();
    const start = now + 5 * 60 * 1000;
    const end = start + cadence * 24 * 60 * 60 * 1000;
    const n = ids.length;
    const step = n <= 1 ? 0 : (end - start) / (n - 1);

    const slots: TenantOutreachSlot[] = [];

    for (let i = 0; i < n; i += 1) {
      const customerId = ids[i]!;
      const row = byId.get(customerId) as JsonRecord | undefined;
      const name = String((row as { name?: string } | undefined)?.name ?? 'Клиент');
      const email =
        filterCustomersForEmailCampaign(row ? [row] : [], target)[0]?.email ??
        String((row as { email?: string } | undefined)?.email ?? '').trim();
      const scheduledAt = new Date(start + i * step).toISOString();

      let subject = baseSubject;
      let bodyT = baseBodyText;
      let personalizedByAi = false;

      if (useAi && i < MAX_AI_PERSONAL) {
        const hint = row ? customerHint(row) : '';
        const system = [
          master,
          brain.brandVoicePrompt ? `Голос бренда:\n${brain.brandVoicePrompt}` : '',
          `Тон: ${brain.tone ?? 50}/100. Эмодзи: ${brain.useEmoji !== false ? 'умеренно' : 'не использовать'}.`,
          'Адаптируй письмо под получателя. Верни СТРОГО в формате:',
          'ТЕМА: ...',
          'ТЕКСТ:',
          '...',
          'Не выдумывай заказы и суммы. Коротко, по-русски.',
        ]
          .filter(Boolean)
          .join('\n\n');
        const user = [
          `Имя получателя: ${name}. Контекст CRM: ${hint}.`,
          `Базовое письмо:\nТЕМА: ${baseSubject}\nТЕКСТ:\n${baseBodyText.slice(0, 6000)}`,
        ].join('\n\n');
        const out = await this.ai.completeText({ system, user, maxTokens: 2048 });
        if (out.text?.trim()) {
          const parsed = parseSubjectBody(out.text);
          subject = parsed.subject;
          bodyT = parsed.body;
          personalizedByAi = true;
        }
        if (out.error) {
          this.log.warn(`personalize ${email}: ${out.error}`);
        }
      }

      if (!personalizedByAi) {
        const m = mergeName(baseSubject, baseBodyText, name);
        subject = m.subject;
        bodyT = m.body;
      }

      slots.push({
        id: randomUUID(),
        customerId,
        email,
        customerName: name,
        scheduledAt,
        subject,
        bodyText: bodyT,
        status: 'pending',
        personalizedByAi,
      });
    }

    const campaign: TenantOutreachCampaign = {
      version: 1,
      status: 'draft',
      target,
      planText,
      baseSubject,
      baseBodyText,
      recipientIds: [...ids],
      updatedAt: now,
      slots,
    };

    this.store.updateTenant(tenantId, (tw) => {
      tw.outreachCampaign = campaign;
    });

    return campaign;
  }

  putCampaign(
    tenantId: string,
    body: {
      planText?: string;
      baseSubject?: string;
      baseBodyText?: string;
      slots?: Array<
        Partial<TenantOutreachSlot> & { id: string; scheduledAt?: string; subject?: string; bodyText?: string }
      >;
    }
  ) {
    const w = this.store.getTenantWorkspace(tenantId);
    const cur = w.outreachCampaign;
    if (!cur) {
      throw new BadRequestException('Сначала сгенерируйте план (POST outreach/generate)');
    }
    if (cur.status === 'running') {
      throw new BadRequestException('Остановите рассылку перед редактированием или правьте только черновик');
    }
    if (cur.status === 'completed') {
      throw new BadRequestException('Кампания завершена — создайте новую генерацию');
    }

    const planText = typeof body.planText === 'string' ? body.planText : cur.planText;
    const baseSubject =
      typeof body.baseSubject === 'string' ? body.baseSubject.slice(0, 300) : cur.baseSubject;
    const baseBodyText =
      typeof body.baseBodyText === 'string' ? body.baseBodyText.slice(0, 50_000) : cur.baseBodyText;

    let slots = cur.slots;
    if (Array.isArray(body.slots) && body.slots.length > 0) {
      const patchById = new Map(body.slots.map((s) => [s.id, s]));
      slots = cur.slots.map((s) => {
        const p = patchById.get(s.id);
        if (!p) return s;
        if (s.status !== 'pending') return s;
        return {
          ...s,
          scheduledAt:
            typeof p.scheduledAt === 'string' && p.scheduledAt.trim()
              ? p.scheduledAt.trim()
              : s.scheduledAt,
          subject:
            typeof p.subject === 'string' ? p.subject.trim().slice(0, 300) : s.subject,
          bodyText:
            typeof p.bodyText === 'string' ? p.bodyText.trim().slice(0, 50_000) : s.bodyText,
        };
      });
    }

    this.store.updateTenant(tenantId, (tw) => {
      if (!tw.outreachCampaign) return;
      tw.outreachCampaign = {
        ...tw.outreachCampaign,
        planText,
        baseSubject,
        baseBodyText,
        slots,
        updatedAt: Date.now(),
      };
    });

    return this.store.getTenantWorkspace(tenantId).outreachCampaign!;
  }

  startCampaign(tenantId: string) {
    this.workspaceForScheduledSends(tenantId);
    const w = this.store.getTenantWorkspace(tenantId);
    const win = subscriptionWindowFromValidUntil(w.billing.validUntil);
    if (win.isExpired) {
      throw new ForbiddenException('Подписка истекла — продлите тариф для отправки');
    }
    const c = w.outreachCampaign;
    if (!c || c.slots.length === 0) {
      throw new BadRequestException('Нет кампании или списка слотов');
    }
    if (c.status === 'running') {
      return c;
    }
    const pending = c.slots.filter((s) => s.status === 'pending');
    if (pending.length === 0) {
      throw new BadRequestException('Нет ожидающих отправки писем');
    }

    this.store.updateTenant(tenantId, (tw) => {
      if (!tw.outreachCampaign) return;
      tw.outreachCampaign = {
        ...tw.outreachCampaign,
        status: 'running',
        updatedAt: Date.now(),
      };
    });

    return this.store.getTenantWorkspace(tenantId).outreachCampaign!;
  }

  pauseCampaign(tenantId: string) {
    const w = this.store.getTenantWorkspace(tenantId);
    const c = w.outreachCampaign;
    if (!c || c.status !== 'running') {
      throw new BadRequestException('Активная рассылка не запущена');
    }
    this.store.updateTenant(tenantId, (tw) => {
      if (!tw.outreachCampaign) return;
      tw.outreachCampaign = {
        ...tw.outreachCampaign,
        status: 'paused',
        updatedAt: Date.now(),
      };
    });
    return this.store.getTenantWorkspace(tenantId).outreachCampaign!;
  }

  private async tickAllTenants() {
    const snap = this.store.getSnapshot();
    for (const tenantId of Object.keys(snap.tenants)) {
      try {
        await this.tickTenant(tenantId);
      } catch (e) {
        this.log.warn(`tick ${tenantId}: ${e instanceof Error ? e.message : e}`);
      }
    }
  }

  private async tickTenant(tenantId: string) {
    const w0 = this.store.getTenantWorkspace(tenantId);
    const c0 = w0.outreachCampaign;
    if (!c0 || c0.status !== 'running') return;

    let w: TenantWorkspace;
    try {
      w = this.workspaceForScheduledSends(tenantId);
    } catch {
      this.store.updateTenant(tenantId, (tw) => {
        if (tw.outreachCampaign?.status === 'running') {
          tw.outreachCampaign = { ...tw.outreachCampaign, status: 'paused', updatedAt: Date.now() };
        }
      });
      return;
    }

    const win = subscriptionWindowFromValidUntil(w.billing.validUntil);
    if (win.isExpired) {
      this.store.updateTenant(tenantId, (tw) => {
        if (tw.outreachCampaign?.status === 'running') {
          tw.outreachCampaign = { ...tw.outreachCampaign, status: 'paused', updatedAt: Date.now() };
        }
      });
      return;
    }

    const c = w.outreachCampaign!;
    const now = Date.now();
    const due = c.slots
      .filter((s) => s.status === 'pending' && new Date(s.scheduledAt).getTime() <= now)
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

    if (due.length === 0) {
      const stillPending = c.slots.some((s) => s.status === 'pending');
      if (!stillPending) {
        this.store.updateTenant(tenantId, (tw) => {
          if (tw.outreachCampaign?.status === 'running') {
            tw.outreachCampaign = { ...tw.outreachCampaign, status: 'completed', updatedAt: Date.now() };
          }
        });
      }
      return;
    }

    const slot = due[0]!;
    const tenantSmtp = getTenantSmtpFromWorkspace(w);
    const brain = w.brain as Parameters<typeof appendBrainOffersToMail>[0];

    await this.sendOneSlot(tenantId, slot, tenantSmtp, brain);

    const w2 = this.store.getTenantWorkspace(tenantId);
    const c2 = w2.outreachCampaign;
    if (c2?.status === 'running') {
      const stillPending = c2.slots.some((s) => s.status === 'pending');
      if (!stillPending) {
        this.store.updateTenant(tenantId, (tw) => {
          if (tw.outreachCampaign?.status === 'running') {
            tw.outreachCampaign = { ...tw.outreachCampaign, status: 'completed', updatedAt: Date.now() };
          }
        });
      }
    }
  }

  private async sendOneSlot(
    tenantId: string,
    slot: TenantOutreachSlot,
    tenantSmtp: ReturnType<typeof getTenantSmtpFromWorkspace>,
    brain: Parameters<typeof appendBrainOffersToMail>[0]
  ) {
    const live = this.store.getTenantWorkspace(tenantId).outreachCampaign?.slots.find((s) => s.id === slot.id);
    if (!live || live.status !== 'pending') return;

    const w0 = this.store.getTenantWorkspace(tenantId);
    if (w0.billing.messagesUsed >= w0.billing.messagesLimit) {
      this.store.updateTenant(tenantId, (tw) => {
        const camp = tw.outreachCampaign;
        if (!camp) return;
        const idx = camp.slots.findIndex((s) => s.id === slot.id);
        if (idx >= 0 && camp.slots[idx]!.status === 'pending') {
          camp.slots[idx] = {
            ...camp.slots[idx]!,
            status: 'skipped_limit',
            lastError: 'Лимит сообщений тарифа',
          };
          camp.updatedAt = Date.now();
        }
      });
      return;
    }

    const htmlBase = plainTextToRetentionHtml(slot.bodyText);
    const { text, html } = appendBrainOffersToMail(brain, slot.bodyText, htmlBase);

    try {
      await this.mail.sendMail(
        {
          to: slot.email,
          subject: slot.subject,
          text,
          html,
        },
        tenantSmtp
      );
      this.store.updateTenant(tenantId, (tw) => {
        tw.billing.messagesUsed = Math.min(tw.billing.messagesLimit, tw.billing.messagesUsed + 1);
        const camp = tw.outreachCampaign;
        if (!camp) return;
        const idx = camp.slots.findIndex((s) => s.id === slot.id);
        if (idx >= 0 && camp.slots[idx]!.status === 'pending') {
          camp.slots[idx] = { ...camp.slots[idx]!, status: 'sent' };
          camp.updatedAt = Date.now();
        }
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.store.updateTenant(tenantId, (tw) => {
        const camp = tw.outreachCampaign;
        if (!camp) return;
        const idx = camp.slots.findIndex((s) => s.id === slot.id);
        if (idx >= 0 && camp.slots[idx]!.status === 'pending') {
          camp.slots[idx] = { ...camp.slots[idx]!, status: 'failed', lastError: msg };
          camp.updatedAt = Date.now();
        }
      });
    }
  }
}
