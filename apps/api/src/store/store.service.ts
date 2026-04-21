import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { asc, count, eq } from 'drizzle-orm';
import { DRIZZLE_DB, type AppDatabase } from '../database/drizzle.tokens';
import { platformAdmins, platformSettings, tenants } from '../database/schema';
import { buildBillingFromPlan, clampAutomationsToEntitlements } from '../subscription/billing-from-plan';
import { entitlementsForPlan } from '../subscription/plan-entitlements';
import { extendValidUntilByDays, subscriptionWindowFromValidUntil } from '../subscription/subscription-dates';
import { createInitialSnapshot, emptyWorkspace } from './create-initial-snapshot';
import { SUPER_TENANT_ROWS, type TenantStatus } from './seed/super.seed';
import type { AppSnapshot, JsonRecord, SuperSlice, TenantWorkspace } from './store.types';

type TenantMeta = {
  id: string;
  name: string;
  slug: string;
  status: string;
  registeredAt: string;
  mrrRub: number;
  generatedMessages30d: number;
  generatedRevenue30dRub: number;
  portalPasswordHash: string | null;
};

@Injectable()
export class StoreService implements OnModuleInit, OnModuleDestroy {
  private snapshot!: AppSnapshot;
  private tenantMetaById = new Map<string, TenantMeta>();
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  /** Очередь flush: один за другим, без гонок при SIGTERM/массовых апдейтах. */
  private flushChain: Promise<void> = Promise.resolve();
  private dirtyTenantIds = new Set<string>();
  private dirtyPlatform = false;

  constructor(
    private readonly config: ConfigService,
    @Inject(DRIZZLE_DB) private readonly db: AppDatabase
  ) {}

  async onModuleInit() {
    await this.bootstrap();
  }

  /** Пул закрывается в DatabaseModule.onApplicationShutdown — после всех onModuleDestroy. */
  async onModuleDestroy() {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    await this.flushChain;
    let pass = 0;
    while ((this.dirtyTenantIds.size > 0 || this.dirtyPlatform) && pass < 30) {
      await this.flushWork();
      pass += 1;
    }
    if (this.dirtyTenantIds.size > 0 || this.dirtyPlatform) {
      console.error(
        '[store] shutdown: не все изменения успели записаться в БД после 30 проходов — проверьте логи выше'
      );
    }
  }

  private async bootstrap() {
    const [settingsRow] = await this.db
      .select()
      .from(platformSettings)
      .where(eq(platformSettings.id, 'global'))
      .limit(1);
    if (!settingsRow) {
      const initial = createInitialSnapshot();
      await this.db.insert(platformSettings).values({
        id: 'global',
        superState: initial.super as unknown as Record<string, unknown>,
        subscriptionPlans: initial.subscriptionPlans,
      });
    }
    const [{ value: tenantCount }] = await this.db.select({ value: count() }).from(tenants);
    if (tenantCount === 0) {
      const initial = createInitialSnapshot();
      for (const row of SUPER_TENANT_ROWS) {
        const ws = initial.tenants[row.id];
        if (!ws) continue;
        await this.db.insert(tenants).values({
          id: row.id,
          name: row.name,
          slug: row.slug,
          status: row.status,
          registeredAt: row.registeredAt,
          mrrRub: row.mrrRub,
          generatedMessages30d: row.generatedMessages30d,
          generatedRevenue30dRub: row.generatedRevenue30dRub,
          portalPasswordHash: null,
          workspace: structuredClone(ws) as unknown as Record<string, unknown>,
        });
      }
    }
    await this.hydrateFromDatabase();
    await this.seedPlatformAdminIfConfigured();
  }

  private async hydrateFromDatabase() {
    const [settingsRow] = await this.db
      .select()
      .from(platformSettings)
      .where(eq(platformSettings.id, 'global'))
      .limit(1);
    if (!settingsRow) {
      throw new Error('platform_settings global row missing after bootstrap');
    }
    const tenantRows = await this.db.select().from(tenants).orderBy(asc(tenants.createdAt));
    this.snapshot = {
      version: 1,
      tenants: {},
      super: settingsRow.superState as unknown as SuperSlice,
      subscriptionPlans: settingsRow.subscriptionPlans as JsonRecord[],
    };
    this.tenantMetaById.clear();
    for (const t of tenantRows) {
      this.snapshot.tenants[t.id] = structuredClone(t.workspace) as unknown as TenantWorkspace;
      this.tenantMetaById.set(t.id, {
        id: t.id,
        name: t.name,
        slug: t.slug,
        status: t.status,
        registeredAt: t.registeredAt,
        mrrRub: t.mrrRub,
        generatedMessages30d: t.generatedMessages30d,
        generatedRevenue30dRub: Number(t.generatedRevenue30dRub),
        portalPasswordHash: t.portalPasswordHash ?? null,
      });
    }
  }

  private async seedPlatformAdminIfConfigured() {
    const [{ value: n }] = await this.db.select({ value: count() }).from(platformAdmins);
    if (n > 0) return;
    const email = this.config.get<string>('PLATFORM_ADMIN_EMAIL')?.trim().toLowerCase();
    const pass = this.config.get<string>('PLATFORM_ADMIN_PASSWORD');
    if (!email || !pass) return;
    const passwordHash = await bcrypt.hash(pass, 12);
    await this.db.insert(platformAdmins).values({ email, passwordHash });
  }

  getSnapshot(): AppSnapshot {
    return this.snapshot;
  }

  getSubscriptionPlans() {
    return this.snapshot.subscriptionPlans;
  }

  ensureTenant(tenantId: string): TenantWorkspace {
    if (!this.snapshot.tenants[tenantId]) {
      this.snapshot.tenants[tenantId] = emptyWorkspace();
      const slug = tenantId.replace(/^t_/, '') || tenantId;
      this.tenantMetaById.set(tenantId, {
        id: tenantId,
        name: tenantId,
        slug,
        status: 'trial',
        registeredAt: new Date().toISOString().slice(0, 10),
        mrrRub: 0,
        generatedMessages30d: 0,
        generatedRevenue30dRub: 0,
        portalPasswordHash: null,
      });
      this.dirtyTenantIds.add(tenantId);
      this.persistSoon();
    }
    return this.snapshot.tenants[tenantId];
  }

  getTenantWorkspace(tenantId: string): TenantWorkspace {
    return this.ensureTenant(tenantId);
  }

  updateTenant(tenantId: string, fn: (w: TenantWorkspace) => void) {
    const w = this.ensureTenant(tenantId);
    fn(w);
    this.dirtyTenantIds.add(tenantId);
    this.persistSoon();
  }

  updateSuper(fn: (s: AppSnapshot['super']) => void) {
    fn(this.snapshot.super);
    this.dirtyPlatform = true;
    this.persistSoon();
  }

  syncInboundSupportChatToTicket(
    tenantId: string,
    msg: { id: string; text: string; images: string[]; ts: number }
  ) {
    const meta = this.tenantMetaById.get(tenantId);
    const tenantName = meta?.name ?? tenantId;
    const extra =
      msg.images.length > 0 ? `\n[Вложения: ${msg.images.length} изображ.]` : '';
    const text = `${msg.text ?? ''}${extra}`.trim() || '[сообщение без текста]';
    const at = new Date(msg.ts).toISOString();
    const ticketMsg = { id: msg.id, from: 'user' as const, text, at };
    this.updateSuper((s) => {
      const tickets = s.supportTickets;
      const idx = tickets.findIndex((t) => {
        const tid = String((t as { tenantId?: string }).tenantId ?? '');
        const st = String((t as { status?: string }).status ?? '');
        return tid === tenantId && st !== 'resolved';
      });
      if (idx >= 0) {
        const t = tickets[idx] as JsonRecord;
        const messages = [...((t.messages as JsonRecord[]) ?? []), ticketMsg as unknown as JsonRecord];
        tickets[idx] = { ...t, messages, updatedAt: at, status: 'open' };
      } else {
        const subjectBase = (msg.text ?? '').trim().replace(/\s+/g, ' ');
        const subject =
          subjectBase.length > 72 ? `${subjectBase.slice(0, 72)}…` : subjectBase || 'Обращение в поддержку';
        tickets.push({
          id: randomUUID(),
          tenantId,
          tenantName,
          subject,
          priority: 'normal',
          status: 'open',
          updatedAt: at,
          messages: [ticketMsg as unknown as JsonRecord],
        } as JsonRecord);
      }
    });
  }

  pushTicketAdminReplyToTenantChat(ticketId: string, replyText: string) {
    const text = replyText.trim();
    if (!text) return;
    const ticket = this.snapshot.super.supportTickets.find(
      (t) => String((t as { id?: string }).id) === ticketId
    ) as { tenantId?: string } | undefined;
    const tenantId = ticket?.tenantId;
    if (!tenantId) return;
    const line = {
      id: randomUUID(),
      role: 'system' as const,
      text,
      images: [] as string[],
      ts: Date.now(),
    };
    this.updateTenant(tenantId, (w) => {
      w.supportChat.push(line);
    });
  }

  listTenantRowsForSuper() {
    const snap = this.snapshot;
    return Array.from(this.tenantMetaById.values()).map((meta) => {
      const w = snap.tenants[meta.id];
      const bill = w?.billing;
      const vu = bill?.validUntil ? String(bill.validUntil) : null;
      const subWin = vu ? subscriptionWindowFromValidUntil(vu) : null;
      return {
        id: meta.id,
        name: meta.name,
        slug: meta.slug,
        plan: bill?.planLabel ?? '—',
        planKey: bill?.planKey ?? null,
        validUntil: vu,
        subscriptionExpired: subWin?.isExpired ?? false,
        subscriptionDaysRemaining: subWin?.daysRemaining ?? null,
        status: (snap.super.tenantStatusOverrides[meta.id] ?? meta.status) as TenantStatus,
        registeredAt: meta.registeredAt,
        mrrRub: meta.mrrRub,
        generatedMessages30d: meta.generatedMessages30d,
        generatedRevenue30dRub: meta.generatedRevenue30dRub,
        chatBlocked: snap.super.chatBlocks[meta.id] ?? false,
        portalAccessConfigured: !!meta.portalPasswordHash,
      };
    });
  }

  tenantExists(tenantId: string): boolean {
    return this.tenantMetaById.has(tenantId);
  }

  getTenantPortalPasswordHash(tenantId: string): string | null {
    return this.tenantMetaById.get(tenantId)?.portalPasswordHash ?? null;
  }

  async setTenantPortalPassword(tenantId: string, password: string): Promise<void> {
    if (password.length < 8) {
      throw new BadRequestException('Пароль не короче 8 символов');
    }
    if (!this.tenantMetaById.has(tenantId)) {
      throw new NotFoundException('Организация не найдена');
    }
    const hash = await bcrypt.hash(password, 12);
    const meta = this.tenantMetaById.get(tenantId)!;
    meta.portalPasswordHash = hash;
    this.dirtyTenantIds.add(tenantId);
    await this.flushTenantRowNow(tenantId);
  }

  /** Сразу пишет строку tenant в PostgreSQL (без debounce), чтобы /super/tenants сразу видел portalPasswordHash и после рестарта данные были в БД. */
  private async flushTenantRowNow(tenantId: string): Promise<void> {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    await this.flushChain;
    this.flushChain = this.flushChain.then(() => this.flushWork());
    await this.flushChain;
  }

  grantComplimentarySubscriptionDays(tenantId: string, days: number) {
    const allowed = new Set([3, 7, 30]);
    if (!allowed.has(days)) {
      throw new BadRequestException('Укажите days: 3, 7 или 30');
    }
    if (!this.tenantMetaById.has(tenantId)) {
      throw new NotFoundException('Организация не найдена');
    }
    const w0 = this.getTenantWorkspace(tenantId);
    const prev = w0.billing.validUntil || new Date().toISOString().slice(0, 10);
    const next = extendValidUntilByDays(prev, days);
    this.updateTenant(tenantId, (w) => {
      w.billing = { ...w.billing, validUntil: next };
    });
    return { ok: true as const, validUntil: next };
  }

  async createTenantOrganization(input: {
    name: string;
    slug: string;
    planKey: string;
    status?: TenantStatus;
  }) {
    const slug = input.slug
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    if (!slug) throw new BadRequestException('Укажите slug (латиница, цифры, дефис)');
    if (slug.length > 128) throw new BadRequestException('Slug после нормализации слишком длинный (макс. 128 символов)');
    const hit = await this.db.select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, slug)).limit(1);
    if (hit.length > 0) throw new BadRequestException('Организация с таким slug уже есть');
    const planKey = String(input.planKey ?? 'trial').trim();
    const id = `t_${randomBytes(6).toString('hex')}`;
    const ws = emptyWorkspace();
    ws.billing = buildBillingFromPlan(planKey, ws.billing);
    const max = entitlementsForPlan(ws.billing.planKey).maxActiveAutomations;
    ws.automations = clampAutomationsToEntitlements(ws.automations, max);
    const status = input.status ?? 'trial';
    const name = input.name.trim() || slug;
    const registeredAt = new Date().toISOString().slice(0, 10);
    await this.db.insert(tenants).values({
      id,
      name,
      slug,
      status,
      registeredAt,
      mrrRub: 0,
      generatedMessages30d: 0,
      generatedRevenue30dRub: 0,
      portalPasswordHash: null,
      workspace: structuredClone(ws) as unknown as Record<string, unknown>,
    });
    await this.hydrateFromDatabase();
    return {
      id,
      name,
      slug,
      status,
      planKey: ws.billing.planKey,
      planLabel: ws.billing.planLabel,
    };
  }

  updateTenantStatusRecord(tenantId: string, status: TenantStatus) {
    const meta = this.tenantMetaById.get(tenantId);
    if (!meta) return false;
    meta.status = status;
    delete this.snapshot.super.tenantStatusOverrides[tenantId];
    this.dirtyTenantIds.add(tenantId);
    this.dirtyPlatform = true;
    this.persistSoon();
    return true;
  }

  private persistSoon() {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      this.flushChain = this.flushChain.then(() => this.flushWork());
    }, 150);
  }

  /** Одна итерация: снимаем dirty только у успешно записанных сущностей (прод: не теряем данные при ошибке БД). */
  private async flushWork(): Promise<void> {
    const ids = [...this.dirtyTenantIds];
    for (const id of ids) {
      if (!this.dirtyTenantIds.has(id)) continue;
      const w = this.snapshot.tenants[id];
      const meta = this.tenantMetaById.get(id);
      if (!w || !meta) {
        this.dirtyTenantIds.delete(id);
        continue;
      }
      const now = new Date();
      try {
        await this.db
          .insert(tenants)
          .values({
            id,
            name: meta.name,
            slug: meta.slug,
            status: meta.status,
            registeredAt: meta.registeredAt,
            mrrRub: meta.mrrRub,
            generatedMessages30d: meta.generatedMessages30d,
            generatedRevenue30dRub: meta.generatedRevenue30dRub,
            portalPasswordHash: meta.portalPasswordHash ?? null,
            workspace: structuredClone(w) as unknown as Record<string, unknown>,
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: tenants.id,
            set: {
              name: meta.name,
              slug: meta.slug,
              status: meta.status,
              registeredAt: meta.registeredAt,
              mrrRub: meta.mrrRub,
              generatedMessages30d: meta.generatedMessages30d,
              generatedRevenue30dRub: meta.generatedRevenue30dRub,
              portalPasswordHash: meta.portalPasswordHash ?? null,
              workspace: structuredClone(w) as unknown as Record<string, unknown>,
              updatedAt: now,
            },
          });
        this.dirtyTenantIds.delete(id);
      } catch (e) {
        console.error(`[store] persist tenant ${id} failed`, e);
      }
    }
    if (!this.dirtyPlatform) return;
    try {
      await this.db
        .update(platformSettings)
        .set({
          superState: this.snapshot.super as unknown as Record<string, unknown>,
          subscriptionPlans: this.snapshot.subscriptionPlans,
        })
        .where(eq(platformSettings.id, 'global'));
      this.dirtyPlatform = false;
    } catch (e) {
      console.error('[store] persist platform failed', e);
    }
  }
}
