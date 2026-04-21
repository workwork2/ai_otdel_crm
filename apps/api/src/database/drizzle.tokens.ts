import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { schema } from './schema';

export const DRIZZLE_DB = Symbol('DRIZZLE_DB');
export const PG_POOL = Symbol('PG_POOL');

export type AppDatabase = NodePgDatabase<typeof schema>;
