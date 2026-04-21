import {
  bigint,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

/** Соответствует бывшей TypeORM-схеме: те же имена колонок (camelCase), что уже в PostgreSQL. */
export const tenants = pgTable('tenants', {
  id: varchar('id', { length: 48 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 128 }).notNull().unique(),
  status: varchar('status', { length: 32 }).notNull(),
  registeredAt: varchar('registeredAt', { length: 32 }).notNull(),
  mrrRub: integer('mrrRub').notNull().default(0),
  generatedMessages30d: integer('generatedMessages30d').notNull().default(0),
  generatedRevenue30dRub: bigint('generatedRevenue30dRub', { mode: 'number' }).notNull().default(0),
  workspace: jsonb('workspace').$type<Record<string, unknown>>().notNull(),
  portalPasswordHash: varchar('portalPasswordHash', { length: 255 }),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
});

export const platformSettings = pgTable('platform_settings', {
  id: varchar('id', { length: 32 }).primaryKey(),
  superState: jsonb('superState').$type<Record<string, unknown>>().notNull(),
  subscriptionPlans: jsonb('subscriptionPlans').$type<unknown[]>().notNull(),
});

export const platformAdmins = pgTable('platform_admins', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('passwordHash', { length: 255 }).notNull(),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
});

export const schema = { tenants, platformSettings, platformAdmins };
