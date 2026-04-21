import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SuperAdminGuard } from '../guards/super-admin.guard';
import {
  buildBillingFromPlan,
  clampAutomationsToEntitlements,
} from '../subscription/billing-from-plan';
import { entitlementsForPlan } from '../subscription/plan-entitlements';
import {
  SUPER_TENANT_ROWS,
  type OnboardingStage,
  type TenantStatus,
} from '../store/seed/super.seed';
import { StoreService } from '../store/store.service';
import type { JsonRecord } from '../store/store.types';

@Controller('v1/super')
@UseGuards(SuperAdminGuard)
export class SuperController {
  constructor(private readonly store: StoreService) {}

  @Get('tenants')
  listTenants() {
    const snap = this.store.getSnapshot();
    return SUPER_TENANT_ROWS.map((t) => {
      const bill = snap.tenants[t.id]?.billing;
      return {
        ...t,
        plan: bill?.planLabel ?? t.plan,
        planKey: bill?.planKey ?? null,
        status: snap.super.tenantStatusOverrides[t.id] ?? t.status,
        chatBlocked: snap.super.chatBlocks[t.id] ?? false,
      };
    });
  }

  @Patch('tenants/:id/plan')
  patchTenantPlan(@Param('id') id: string, @Body() body: { planKey?: string }) {
    const planKey = String(body?.planKey ?? '').trim();
    if (!planKey) return { ok: false, error: 'planKey required' };
    this.store.updateTenant(id, (w) => {
      w.billing = buildBillingFromPlan(planKey, w.billing);
      const max = entitlementsForPlan(w.billing.planKey).maxActiveAutomations;
      w.automations = clampAutomationsToEntitlements(w.automations, max);
    });
    return { ok: true };
  }

  @Patch('tenants/:id/status')
  patchTenantStatus(@Param('id') id: string, @Body() body: { status?: TenantStatus }) {
    const status = body.status;
    if (!status) return { ok: false };
    const orig = SUPER_TENANT_ROWS.find((x) => x.id === id)?.status;
    this.store.updateSuper((s) => {
      if (status === orig) delete s.tenantStatusOverrides[id];
      else s.tenantStatusOverrides[id] = status;
    });
    return { ok: true };
  }

  @Patch('tenants/:id/chat-block')
  patchChatBlock(@Param('id') id: string, @Body() body: { blocked?: boolean }) {
    const blocked = !!body.blocked;
    this.store.updateSuper((s) => {
      if (!blocked) delete s.chatBlocks[id];
      else s.chatBlocks[id] = true;
    });
    return { ok: true };
  }

  @Get('metrics')
  metrics() {
    return this.store.getSnapshot().super.globalMetrics;
  }

  @Get('monitoring')
  monitoring() {
    const s = this.store.getSnapshot().super;
    return { queueStats: s.queueStats, integrationErrors: s.integrationErrors };
  }

  @Get('ai-errors')
  aiErrors() {
    return this.store.getSnapshot().super.aiErrorLogs;
  }

  @Get('master-prompt')
  getMasterPrompt() {
    return { prompt: this.store.getSnapshot().super.masterPrompt };
  }

  @Put('master-prompt')
  putMasterPrompt(@Body() body: { prompt?: string }) {
    const prompt = String(body?.prompt ?? '');
    this.store.updateSuper((s) => {
      s.masterPrompt = prompt;
    });
    return { prompt: this.store.getSnapshot().super.masterPrompt };
  }

  @Get('support-tickets')
  supportTickets() {
    return this.store.getSnapshot().super.supportTickets;
  }

  @Post('support-tickets/:ticketId/messages')
  postTicketMessage(
    @Param('ticketId') ticketId: string,
    @Body() body: { from?: 'user' | 'admin'; text?: string }
  ) {
    const text = String(body?.text ?? '').trim();
    const from = body?.from === 'user' ? 'user' : 'admin';
    if (!text) return { ok: false };
    const at = new Date().toISOString();
    this.store.updateSuper((s) => {
      s.supportTickets = s.supportTickets.map((t) => {
        const id = String((t as { id?: string }).id);
        if (id !== ticketId) return t;
        const messages = [
          ...((t as { messages?: JsonRecord[] }).messages ?? []),
          { id: randomUUID(), from, text, at },
        ];
        return { ...(t as object), messages, updatedAt: at, status: 'pending' };
      });
    });
    return { ok: true };
  }

  @Patch('support-tickets/:ticketId')
  patchTicket(
    @Param('ticketId') ticketId: string,
    @Body() body: { status?: 'open' | 'pending' | 'resolved' }
  ) {
    if (!body.status) return { ok: false };
    const at = new Date().toISOString();
    this.store.updateSuper((s) => {
      s.supportTickets = s.supportTickets.map((t) => {
        const id = String((t as { id?: string }).id);
        if (id !== ticketId) return t;
        return { ...(t as object), status: body.status, updatedAt: at };
      });
    });
    return { ok: true };
  }

  @Get('onboarding')
  onboarding() {
    const s = this.store.getSnapshot().super;
    return s.onboarding.map((row) => {
      const id = String((row as { id?: string }).id);
      return {
        ...row,
        stage: s.onboardingStages[id] ?? (row as { stage?: OnboardingStage }).stage,
      };
    });
  }

  @Patch('onboarding/:rowId/stage')
  patchOnboardingStage(
    @Param('rowId') rowId: string,
    @Body() body: { stage?: OnboardingStage }
  ) {
    if (!body.stage) return { ok: false };
    this.store.updateSuper((s) => {
      s.onboardingStages[rowId] = body.stage!;
    });
    return { ok: true };
  }
}
