import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { createInitialSnapshot, emptyWorkspace } from './create-initial-snapshot';
import type { AppSnapshot, TenantWorkspace } from './store.types';

@Injectable()
export class StoreService implements OnModuleInit {
  private snapshot!: AppSnapshot;
  private dataPath!: string;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const raw = this.config.get<string>('DATA_PATH', 'data/state.json');
    this.dataPath = path.isAbsolute(raw) ? raw : path.join(process.cwd(), raw);
    this.load();
  }

  private load() {
    try {
      const dir = path.dirname(this.dataPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      if (fs.existsSync(this.dataPath)) {
        const raw = fs.readFileSync(this.dataPath, 'utf-8');
        this.snapshot = JSON.parse(raw) as AppSnapshot;
        if (!this.snapshot?.tenants || !this.snapshot?.super) throw new Error('bad snapshot');
        return;
      }
    } catch (e) {
      console.warn('[store] reset to initial:', e);
    }
    this.snapshot = createInitialSnapshot();
    this.persistSoon();
  }

  private persistSoon() {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => this.persistNow(), 120);
  }

  private persistNow() {
    this.persistTimer = null;
    try {
      const dir = path.dirname(this.dataPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const tmp = `${this.dataPath}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.snapshot, null, 2), 'utf-8');
      fs.renameSync(tmp, this.dataPath);
    } catch (e) {
      console.error('[store] persist failed', e);
    }
  }

  getSnapshot(): AppSnapshot {
    return this.snapshot;
  }

  ensureTenant(tenantId: string): TenantWorkspace {
    if (!this.snapshot.tenants[tenantId]) {
      this.snapshot.tenants[tenantId] = emptyWorkspace();
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
    this.persistSoon();
  }

  updateSuper(fn: (s: AppSnapshot['super']) => void) {
    fn(this.snapshot.super);
    this.persistSoon();
  }

  getSubscriptionPlans() {
    return this.snapshot.subscriptionPlans;
  }
}
