import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

const LEGACY_APP_TABLES = ['platform_admins', 'platform_settings', 'tenants'] as const;

/**
 * БД уже создана (TypeORM sync / ручной SQL), а журнал drizzle пустой — без baseline migrate()
 * снова выполнит CREATE TABLE и упадёт с "already exists".
 */
async function ensureLegacyBaselineIfNeeded(pool: pg.Pool, migrationsFolder: string): Promise<void> {
  const { rows: cntRows } = await pool.query<{ c: number }>(
    `select count(*)::int as c from pg_tables
     where schemaname = 'public' and tablename = any($1::text[])`,
    [LEGACY_APP_TABLES as unknown as string[]]
  );
  if (!cntRows[0] || cntRows[0].c < LEGACY_APP_TABLES.length) return;

  await pool.query(`create schema if not exists "drizzle"`);
  await pool.query(`create table if not exists "drizzle"."__drizzle_migrations" (
    id serial primary key,
    hash text not null,
    created_at bigint
  )`);

  const journalPath = path.join(migrationsFolder, 'meta', '_journal.json');
  if (!fs.existsSync(journalPath)) return;
  const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8')) as {
    entries: Array<{ tag: string; when: number }>;
  };
  const first = journal.entries[0];
  if (!first) return;

  const sqlPath = path.join(migrationsFolder, `${first.tag}.sql`);
  if (!fs.existsSync(sqlPath)) return;
  const sqlBody = fs.readFileSync(sqlPath, 'utf8');
  const hash = crypto.createHash('sha256').update(sqlBody).digest('hex');

  const exists = await pool.query(
    `select 1 from "drizzle"."__drizzle_migrations" where hash = $1 limit 1`,
    [hash]
  );
  if (exists.rowCount && exists.rowCount > 0) return;

  await pool.query(
    `insert into "drizzle"."__drizzle_migrations" ("hash", "created_at") values ($1, $2)`,
    [hash, first.when]
  );
  console.warn(
    '[drizzle] В public уже есть таблицы приложения, а журнал миграций был пуст — ' +
      'первая миграция помечена применённой (baseline). Новые миграции будут накатываться как обычно.'
  );
}

/**
 * Применяет SQL из apps/api/drizzle до старта Nest (идемпотентно по журналу Drizzle).
 * В Kubernetes/проде часто отключают на поде (RUN_MIGRATIONS=false) и гоняют migrate отдельным Job.
 */
export async function runMigrationsIfEnabled(): Promise<void> {
  if (process.env.RUN_MIGRATIONS === 'false') return;
  const url = process.env.DATABASE_URL;
  if (!url?.trim()) {
    throw new Error('DATABASE_URL is required (load apps/api/.env or export in shell)');
  }
  const pool = new pg.Pool({ connectionString: url.trim() });
  const migrationsFolder = path.join(process.cwd(), 'drizzle');
  try {
    await ensureLegacyBaselineIfNeeded(pool, migrationsFolder);
    const db = drizzle(pool);
    await migrate(db, { migrationsFolder });
  } finally {
    await pool.end();
  }
}
