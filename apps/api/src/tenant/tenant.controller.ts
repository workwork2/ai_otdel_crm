import { randomUUID } from 'crypto';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { buildAnalyticsDigestForPrompt } from '../ai/analytics-digest';
import {
  mergeQaDialoguesWithSupportChat,
  stripSyntheticSupportDialogue,
} from '../qa/support-qa-merge';
import { AiService } from '../ai/ai.service';
import { TenantPortalGuard } from '../auth/tenant-portal.guard';
import {
  buildRetentionEmailContent,
  filterCustomersForEmailCampaign,
  plainTextToRetentionHtml,
  type RetentionTarget,
} from '../mail/retention-audience';
import { MailService } from '../mail/mail.service';
import {
  buildBillingFromPlan,
  clampAutomationsToEntitlements,
} from '../subscription/billing-from-plan';
import { entitlementsForPlan } from '../subscription/plan-entitlements';
import { subscriptionWindowFromValidUntil } from '../subscription/subscription-dates';
import {
  getTenantSmtpFromWorkspace,
  mergeIntegrationsForClient,
  mergeIntegrationsPreserveSecrets,
  type IntegrationRow,
} from '../integrations/integration-helpers';
import { OutreachService } from '../outreach/outreach.service';
import { StoreService } from '../store/store.service';
import type { JsonRecord, TenantWorkspace } from '../store/store.types';

@Controller('v1/tenant/:tenantId')
@UseGuards(TenantPortalGuard)
export class TenantController {
  constructor(
    private readonly store: StoreService,
    private readonly ai: AiService,
    private readonly mail: MailService,
    private readonly outreach: OutreachService
  ) {}

  /** Рассылки: тариф + канал Email подключён + SMTP (в карточке Email или глобально в API). */
  private workspaceForEmailCampaigns(tenantId: string): TenantWorkspace {
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
        'Укажите SMTP в настройках интеграции «Email» (хост, порт, логин, пароль) или задайте SMTP_HOST, SMTP_USER, SMTP_PASS в окружении API'
      );
    }
    return w;
  }

  private subscriptionPayload(w: TenantWorkspace) {
    const entitlements = entitlementsForPlan(w.billing.planKey);
    const win = subscriptionWindowFromValidUntil(w.billing.validUntil);
    return {
      planKey: w.billing.planKey,
      planLabel: w.billing.planLabel,
      billing: w.billing,
      entitlements,
      isExpired: win.isExpired,
      daysRemaining: win.daysRemaining,
    };
  }

  @Get('workspace-meta')
  workspaceMeta(@Param('tenantId') tenantId: string) {
    const snap = this.store.getSnapshot();
    return { supportChatBlocked: snap.super.chatBlocks[tenantId] ?? false };
  }

  @Get('customers')
  getCustomers(@Param('tenantId') tenantId: string) {
    return this.store.getTenantWorkspace(tenantId).customers;
  }

  @Put('customers')
  putCustomers(@Param('tenantId') tenantId: string, @Body() body: JsonRecord[]) {
    const next = Array.isArray(body) ? body : [];
    const w0 = this.store.getTenantWorkspace(tenantId);
    if (next.length > w0.billing.audienceLimit) {
      throw new BadRequestException(
        `Лимит базы на тарифе: ${w0.billing.audienceLimit} контактов. Повысьте тариф в разделе «Мой тариф».`
      );
    }
    this.store.updateTenant(tenantId, (w) => {
      w.customers = next;
    });
    return this.store.getTenantWorkspace(tenantId).customers;
  }

  @Post('customers/merge')
  mergeCustomers(@Param('tenantId') tenantId: string, @Body() body: { customers?: JsonRecord[] }) {
    const add = body?.customers ?? [];
    const w0 = this.store.getTenantWorkspace(tenantId);
    const ent = entitlementsForPlan(w0.billing.planKey);
    if (!ent.excelImport) {
      throw new ForbiddenException('Импорт базы недоступен на текущем тарифе');
    }
    let toAdd = 0;
    const ids0 = new Set(w0.customers.map((c) => String((c as { id?: string }).id)));
    for (const row of add) {
      const id = String((row as { id?: string }).id ?? '');
      if (id && !ids0.has(id)) toAdd += 1;
    }
    if (w0.customers.length + toAdd > w0.billing.audienceLimit) {
      throw new BadRequestException(
        `Лимит базы: ${w0.billing.audienceLimit} контактов. Увеличьте тариф или удалите записи.`
      );
    }
    this.store.updateTenant(tenantId, (w) => {
      const ids = new Set(w.customers.map((c) => String((c as { id?: string }).id)));
      for (const row of add) {
        const id = String((row as { id?: string }).id ?? '');
        if (id && !ids.has(id)) {
          w.customers.push(row);
          ids.add(id);
        }
      }
    });
    return this.store.getTenantWorkspace(tenantId).customers;
  }

  @Get('qa')
  getQa(@Param('tenantId') tenantId: string) {
    const w = this.store.getTenantWorkspace(tenantId);
    return mergeQaDialoguesWithSupportChat(w.qaDialogues, w.supportChat);
  }

  @Put('qa')
  putQa(@Param('tenantId') tenantId: string, @Body() body: JsonRecord[]) {
    const list = Array.isArray(body) ? body : [];
    const stored = stripSyntheticSupportDialogue(list);
    this.store.updateTenant(tenantId, (w) => {
      w.qaDialogues = stored;
    });
    const w = this.store.getTenantWorkspace(tenantId);
    return mergeQaDialoguesWithSupportChat(w.qaDialogues, w.supportChat);
  }

  @Get('brain')
  getBrain(@Param('tenantId') tenantId: string) {
    return this.store.getTenantWorkspace(tenantId).brain;
  }

  @Put('brain')
  putBrain(@Param('tenantId') tenantId: string, @Body() body: JsonRecord) {
    this.store.updateTenant(tenantId, (w) => {
      w.brain = { ...w.brain, ...body };
    });
    return this.store.getTenantWorkspace(tenantId).brain;
  }

  @Get('billing')
  getBilling(@Param('tenantId') tenantId: string) {
    return this.store.getTenantWorkspace(tenantId).billing;
  }

  @Get('subscription')
  getSubscription(@Param('tenantId') tenantId: string) {
    const w = this.store.getTenantWorkspace(tenantId);
    return this.subscriptionPayload(w);
  }

  @Patch('billing/plan')
  patchBillingPlan(
    @Param('tenantId') tenantId: string,
    @Body() body: { planKey?: string }
  ) {
    const planKey = String(body?.planKey ?? '').trim();
    if (!planKey) throw new BadRequestException('Укажите planKey');
    this.store.updateTenant(tenantId, (w) => {
      w.billing = buildBillingFromPlan(planKey, w.billing);
      const max = entitlementsForPlan(w.billing.planKey).maxActiveAutomations;
      w.automations = clampAutomationsToEntitlements(w.automations, max);
    });
    return this.subscriptionPayload(this.store.getTenantWorkspace(tenantId));
  }

  @Get('automations')
  getAutomations(@Param('tenantId') tenantId: string) {
    return this.store.getTenantWorkspace(tenantId).automations;
  }

  @Put('automations')
  putAutomations(
    @Param('tenantId') tenantId: string,
    @Body() body: { automations?: TenantWorkspace['automations'] }
  ) {
    const list = body?.automations;
    if (Array.isArray(list)) {
      this.store.updateTenant(tenantId, (w) => {
        const max = entitlementsForPlan(w.billing.planKey).maxActiveAutomations;
        w.automations = clampAutomationsToEntitlements(list, max);
      });
    }
    return this.store.getTenantWorkspace(tenantId).automations;
  }

  @Get('integrations')
  getIntegrations(@Param('tenantId') tenantId: string) {
    const w = this.store.getTenantWorkspace(tenantId);
    return mergeIntegrationsForClient(w.integrations);
  }

  @Put('integrations')
  putIntegrations(@Param('tenantId') tenantId: string, @Body() body: { integrations?: unknown }) {
    const w0 = this.store.getTenantWorkspace(tenantId);
    if (!entitlementsForPlan(w0.billing.planKey).integrationsManage) {
      throw new ForbiddenException('Управление интеграциями недоступно на текущем тарифе');
    }
    const list = body?.integrations;
    if (Array.isArray(list)) {
      const merged = mergeIntegrationsPreserveSecrets(w0.integrations, list as IntegrationRow[]);
      this.store.updateTenant(tenantId, (w) => {
        w.integrations = merged;
      });
    }
    return mergeIntegrationsForClient(this.store.getTenantWorkspace(tenantId).integrations);
  }

  @Get('email/status')
  emailIntegrationStatus(@Param('tenantId') tenantId: string) {
    const w = this.store.getTenantWorkspace(tenantId);
    const tenantSmtp = getTenantSmtpFromWorkspace(w);
    const tenantOk = this.mail.isTenantSmtpConfigured(tenantSmtp);
    const globalOk = this.mail.isConfigured();
    const from = tenantOk
      ? tenantSmtp!.smtpFrom?.trim()
        ? tenantSmtp!.smtpFrom.trim()
        : `AI Отдел <${tenantSmtp!.smtpUser.trim()}>`
      : this.mail.getFrom();
    return {
      configured: tenantOk || globalOk,
      from,
      source: tenantOk ? 'tenant' : globalOk ? 'global' : 'none',
    };
  }

  /** Проверка SMTP (AUTH + приветствие сервера) без отправки письма. */
  @Post('email/verify')
  async verifyEmailSmtp(@Param('tenantId') tenantId: string) {
    this.workspaceForEmailCampaigns(tenantId);
    const w = this.store.getTenantWorkspace(tenantId);
    const tenantSmtp = getTenantSmtpFromWorkspace(w);
    if (!this.mail.isConfigured() && !this.mail.isTenantSmtpConfigured(tenantSmtp)) {
      throw new BadRequestException(
        'SMTP не настроен: заполните интеграцию «Email» или SMTP_* в окружении API'
      );
    }
    try {
      await this.mail.verifySmtp(tenantSmtp);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new BadRequestException(msg || 'Проверка SMTP не удалась');
    }
    return { ok: true as const };
  }

  @Post('email/test')
  async sendTestEmail(
    @Param('tenantId') tenantId: string,
    @Body() body: { to?: string }
  ) {
    this.workspaceForEmailCampaigns(tenantId);
    const to = String(body?.to ?? '').trim();
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      throw new BadRequestException('Укажите корректный email в поле to');
    }
    const w = this.store.getTenantWorkspace(tenantId);
    const tenantSmtp = getTenantSmtpFromWorkspace(w);
    if (!this.mail.isConfigured() && !this.mail.isTenantSmtpConfigured(tenantSmtp)) {
      throw new BadRequestException(
        'SMTP не настроен: заполните поля в интеграции «Email» или задайте SMTP_* в окружении API'
      );
    }
    try {
      await this.mail.sendMail(
        {
          to,
          subject: 'Проверка SMTP — AI Отдел',
          text: 'Если вы видите это письмо, интеграция почты работает.',
        },
        tenantSmtp
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new BadRequestException(msg || 'Не удалось отправить тестовое письмо');
    }
    return { ok: true };
  }

  /** Персональная кампания: план, слоты, лимиты биллинга (см. POST generate / start). */
  @Get('outreach/campaign')
  outreachCampaignGet(@Param('tenantId') tenantId: string) {
    return this.outreach.getCampaignView(tenantId);
  }

  @Post('outreach/generate')
  async outreachGenerate(
    @Param('tenantId') tenantId: string,
    @Body()
    body: {
      target?: RetentionTarget;
      recipientIds?: string[];
      baseSubject?: string;
      baseBodyText?: string;
    }
  ) {
    return this.outreach.generateCampaign(tenantId, body);
  }

  @Put('outreach/campaign')
  outreachCampaignPut(
    @Param('tenantId') tenantId: string,
    @Body()
    body: {
      planText?: string;
      baseSubject?: string;
      baseBodyText?: string;
      slots?: Array<{
        id: string;
        scheduledAt?: string;
        subject?: string;
        bodyText?: string;
      }>;
    }
  ) {
    return this.outreach.putCampaign(tenantId, body);
  }

  @Post('outreach/start')
  outreachStart(@Param('tenantId') tenantId: string) {
    return this.outreach.startCampaign(tenantId);
  }

  @Post('outreach/pause')
  outreachPause(@Param('tenantId') tenantId: string) {
    return this.outreach.pauseCampaign(tenantId);
  }

  /** Рассылка удержания: когорта из CRM или все с маркетинговым согласием. */
  @Post('email/retention-campaign')
  async sendRetentionCampaign(
    @Param('tenantId') tenantId: string,
    @Body()
    body: {
      target?: RetentionTarget;
      limit?: number;
      dryRun?: boolean;
      /** Если задано — только эти id (пересечение с отбором по сегменту). */
      recipientIds?: string[];
      /** Своя тема и текст письма вместо сценария автоматизаций. */
      customContent?: { subject?: string; text?: string };
    }
  ) {
    const w = this.workspaceForEmailCampaigns(tenantId);
    const tenantSmtp = getTenantSmtpFromWorkspace(w);
    const target: RetentionTarget = body?.target === 'marketing' ? 'marketing' : 'retention';
    const limit = Math.min(500, Math.max(1, Number(body?.limit) || 50));
    const dryRun = !!body?.dryRun;
    let recipients = filterCustomersForEmailCampaign(w.customers, target);
    const idFilter = body?.recipientIds;
    if (Array.isArray(idFilter) && idFilter.length > 0) {
      const allow = new Set(idFilter.map((x) => String(x)));
      recipients = recipients.filter((r) => allow.has(r.id));
    }
    recipients = recipients.slice(0, limit);

    if (dryRun) {
      return {
        dryRun: true,
        target,
        count: recipients.length,
        sampleEmails: recipients.map((r) => r.email),
      };
    }

    const cc = body?.customContent;
    const subj = typeof cc?.subject === 'string' ? cc.subject.trim() : '';
    const txt = typeof cc?.text === 'string' ? cc.text.trim() : '';
    const content =
      subj.length >= 1 && txt.length >= 1
        ? {
            subject: subj.slice(0, 300),
            text: txt.slice(0, 50_000),
            html: plainTextToRetentionHtml(txt.slice(0, 50_000)),
          }
        : buildRetentionEmailContent(w);

    if (recipients.length === 0) {
      throw new BadRequestException(
        'Нет получателей: проверьте базу (согласие marketing, валидный email без маски *) и для режима retention — сегмент риска в скоринге'
      );
    }

    let sent = 0;
    const errors: string[] = [];
    for (const r of recipients) {
      try {
        await this.mail.sendMail(
          {
            to: r.email,
            subject: content.subject,
            text: content.text,
            html: content.html,
          },
          tenantSmtp
        );
        sent += 1;
      } catch (e) {
        errors.push(`${r.email}: ${e instanceof Error ? e.message : 'ошибка отправки'}`);
      }
    }

    return {
      target,
      attempted: recipients.length,
      sent,
      failed: recipients.length - sent,
      errors: errors.slice(0, 15),
    };
  }

  @Get('support-chat')
  getSupportChat(@Param('tenantId') tenantId: string) {
    return this.store.getTenantWorkspace(tenantId).supportChat;
  }

  @Post('support-chat')
  postSupportChat(
    @Param('tenantId') tenantId: string,
    @Body() body: { role: 'user' | 'system'; text: string; images?: string[] }
  ) {
    const msg = {
      id: randomUUID(),
      role: body.role,
      text: body.text ?? '',
      images: Array.isArray(body.images) ? body.images : [],
      ts: Date.now(),
    };
    this.store.updateTenant(tenantId, (w) => {
      w.supportChat.push(msg);
    });
    if (body.role === 'user') {
      this.store.syncInboundSupportChatToTicket(tenantId, msg);
    }
    return msg;
  }

  @Delete('support-chat')
  resetSupportChat(@Param('tenantId') tenantId: string) {
    const welcome = {
      id: 'welcome',
      role: 'system' as const,
      text: 'Здравствуйте! Опишите проблему или прикрепите скриншоты — сообщения синхронизируются с бэкендом, если включён API.',
      images: [] as string[],
      ts: Date.now(),
    };
    this.store.updateTenant(tenantId, (w) => {
      w.supportChat = [welcome];
    });
    return this.store.getTenantWorkspace(tenantId).supportChat;
  }

  @Post('ai/refine')
  async refine(
    @Param('tenantId') tenantId: string,
    @Body() body: { instruction?: string; draft?: string }
  ) {
    if (!entitlementsForPlan(this.store.getTenantWorkspace(tenantId).billing.planKey).aiRefineCopy) {
      throw new ForbiddenException('ИИ-доработка текстов доступна с тарифа Starter и выше');
    }
    const instruction = String(body?.instruction ?? '').trim();
    const draft = String(body?.draft ?? '').trim();
    const master = this.store.getSnapshot().super.masterPrompt;
    const brain = this.store.getTenantWorkspace(tenantId).brain as { systemPrompt?: string };
    const system = [
      master,
      brain?.systemPrompt ? `Правила воркспейса:\n${brain.systemPrompt}` : '',
      'Задача: отредактируй маркетинговый или клиентский текст по инструкции. Верни только итоговый текст, без пояснений.',
      'Если исходник почти пустой, бессмысленный или тестовый — не копируй «мусор»; по любым зацепкам (название акции, дата, скидка) напиши один короткий дружелюбный абзац для клиента на русском.',
    ]
      .filter(Boolean)
      .join('\n\n');
    const thinDraft = draft.length < 40;
    const user =
      `${instruction}\n\nИсходный текст:\n---\n${draft}\n---` +
      (thinDraft
        ? '\n\nЕсли в блоке выше мало смысла, всё равно сформулируй готовый текст акции по инструкции и дате/заголовку, без цитирования случайных символов.'
        : '');
    const out = await this.ai.completeText({ system, user, maxTokens: 2048 });
    return { text: out.text, provider: out.provider, error: out.error };
  }

  @Post('ai/suggest-reply')
  async suggestReply(
    @Param('tenantId') tenantId: string,
    @Body() body: { dialogue?: string; channel?: string; issue?: string }
  ) {
    if (!entitlementsForPlan(this.store.getTenantWorkspace(tenantId).billing.planKey).qaFullAccess) {
      throw new ForbiddenException('Подсказки ответов в QA доступны с тарифа Starter и выше');
    }
    const master = this.store.getSnapshot().super.masterPrompt;
    const brain = this.store.getTenantWorkspace(tenantId).brain as {
      systemPrompt?: string;
      brandVoicePrompt?: string;
      maxDiscountPercent?: number;
    };
    const system = [
      master,
      brain.systemPrompt,
      brain.brandVoicePrompt,
      `Максимальная скидка по правилам воркспейса: ${brain.maxDiscountPercent ?? 15}%.`,
      'Ты помогаешь менеджеру или ИИ ответить клиенту. Дай один готовый ответ сообщением, без преамбулы «конечно», по делу, на русском.',
    ]
      .filter(Boolean)
      .join('\n\n');
    const user = [
      body.channel ? `Канал: ${body.channel}` : '',
      body.issue ? `Контекст проблемы: ${body.issue}` : '',
      'Диалог:',
      body.dialogue ?? '',
    ]
      .filter(Boolean)
      .join('\n');
    const out = await this.ai.completeText({ system, user, maxTokens: 1024 });
    return { text: out.text, provider: out.provider, error: out.error };
  }

  /** ИИ-сводка по базе клиентов и QA (Anthropic). Данные только из воркспейса tenant. */
  @Post('ai/analytics-report')
  async analyticsReport(@Param('tenantId') tenantId: string) {
    const w = this.store.getTenantWorkspace(tenantId);
    if (!entitlementsForPlan(w.billing.planKey).aiRefineCopy) {
      throw new ForbiddenException('ИИ-отчёты доступны с тарифа Starter и выше');
    }
    const master = this.store.getSnapshot().super.masterPrompt;
    const digest = buildAnalyticsDigestForPrompt(w);
    const system = [
      master,
      'Ты аналитик для B2C/B2B retail. По агрегированным данным ниже подготовь отчёт для владельца бизнеса на русском.',
      'Формат ответа: Markdown с заголовками ##',
      'Разделы: 1) Краткое резюме 2) Сегменты и база 3) Риски оттока и QA 4) Что улучшить на этой неделе 5) Идеи касаний (без выдуманных персональных данных).',
      'Не придумывай цифры, которых нет во входных данных. Если база пуста — так и напиши и дай общие рекомендации.',
    ].join('\n\n');
    const user = `Данные воркспейса (агрегаты):\n\n${digest}`;
    const out = await this.ai.completeText({ system, user, maxTokens: 4096 });
    return { text: out.text, provider: out.provider, error: out.error };
  }
}
