import type { TenantStatus, OnboardingStage } from './seed/super.seed';

export type JsonRecord = Record<string, unknown>;

export interface TenantWorkspace {
  customers: JsonRecord[];
  qaDialogues: JsonRecord[];
  brain: JsonRecord;
  automations: Array<{
    id: string;
    name: string;
    desc: string;
    tag?: string;
    status: 'active' | 'paused';
  }>;
  integrations: Array<{
    id: string;
    name: string;
    category: string;
    status: 'connected' | 'available' | 'error';
    /** Учётные данные и URL (хранятся в workspace; секреты маскируются в GET). */
    config?: JsonRecord;
  }>;
  billing: {
    planKey: string;
    planLabel: string;
    priceRubMonthly: number;
    validUntil: string;
    messagesUsed: number;
    messagesLimit: number;
    audienceUsed: number;
    audienceLimit: number;
    invoices: Array<{ date: string; doc: string; amountRub: number; status: string }>;
  };
  supportChat: Array<{
    id: string;
    role: 'user' | 'system';
    text: string;
    images: string[];
    ts: number;
  }>;
}

export interface SuperSlice {
  globalMetrics: JsonRecord;
  aiErrorLogs: JsonRecord[];
  integrationErrors: JsonRecord[];
  queueStats: JsonRecord[];
  masterPrompt: string;
  tenantStatusOverrides: Record<string, TenantStatus>;
  chatBlocks: Record<string, boolean>;
  onboarding: JsonRecord[];
  onboardingStages: Record<string, OnboardingStage>;
  supportTickets: JsonRecord[];
}

export interface AppSnapshot {
  version: 1;
  tenants: Record<string, TenantWorkspace>;
  super: SuperSlice;
  subscriptionPlans: JsonRecord[];
}
