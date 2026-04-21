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
import { AiService } from '../ai/ai.service';
import { TenantApiGuard } from '../guards/tenant-api.guard';
import {
  buildBillingFromPlan,
  clampAutomationsToEntitlements,
} from '../subscription/billing-from-plan';
import { entitlementsForPlan } from '../subscription/plan-entitlements';
import { StoreService } from '../store/store.service';
import type { JsonRecord, TenantWorkspace } from '../store/store.types';

@Controller('v1/tenant/:tenantId')
@UseGuards(TenantApiGuard)
export class TenantController {
  constructor(
    private readonly store: StoreService,
    private readonly ai: AiService
  ) {}

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
    return this.store.getTenantWorkspace(tenantId).qaDialogues;
  }

  @Put('qa')
  putQa(@Param('tenantId') tenantId: string, @Body() body: JsonRecord[]) {
    this.store.updateTenant(tenantId, (w) => {
      w.qaDialogues = Array.isArray(body) ? body : [];
    });
    return this.store.getTenantWorkspace(tenantId).qaDialogues;
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
    const entitlements = entitlementsForPlan(w.billing.planKey);
    return {
      planKey: w.billing.planKey,
      planLabel: w.billing.planLabel,
      billing: w.billing,
      entitlements,
    };
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
    const w = this.store.getTenantWorkspace(tenantId);
    return {
      planKey: w.billing.planKey,
      planLabel: w.billing.planLabel,
      billing: w.billing,
      entitlements: entitlementsForPlan(w.billing.planKey),
    };
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
    return this.store.getTenantWorkspace(tenantId).integrations;
  }

  @Put('integrations')
  putIntegrations(@Param('tenantId') tenantId: string, @Body() body: { integrations?: unknown }) {
    const w0 = this.store.getTenantWorkspace(tenantId);
    if (!entitlementsForPlan(w0.billing.planKey).integrationsManage) {
      throw new ForbiddenException('Управление интеграциями недоступно на текущем тарифе');
    }
    const list = body?.integrations;
    if (Array.isArray(list)) {
      this.store.updateTenant(tenantId, (w) => {
        w.integrations = list as typeof w.integrations;
      });
    }
    return this.store.getTenantWorkspace(tenantId).integrations;
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
    ]
      .filter(Boolean)
      .join('\n\n');
    const user = `${instruction}\n\nИсходный текст:\n---\n${draft}\n---`;
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
}
