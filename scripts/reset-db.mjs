#!/usr/bin/env node
/**
 * Полный сброс локальной БД: tenants, platform_settings (global), platform_admins.
 * После запуска перезапустите API — подтянется чистый снимок платформы без организаций.
 *
 *   CONFIRM_RESET=1 npm run db:reset
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL?.trim()) return process.env.DATABASE_URL.trim();
  const envPath = path.join(__dirname, '..', 'apps', 'api', '.env');
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    if (t.slice(0, eq).trim() !== 'DATABASE_URL') continue;
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (val) return val;
  }
  throw new Error('Задайте DATABASE_URL в apps/api/.env или в окружении');
}

if (process.env.CONFIRM_RESET !== '1') {
  console.error(`
Сброс удалит всех арендаторов, глобальные настройки платформы и учётки главного админа.

  CONFIRM_RESET=1 npm run db:reset

Убедитесь, что PostgreSQL запущен (npm run postgres:up).
`);
  process.exit(1);
}

const url = loadDatabaseUrl();
const client = new pg.Client({ connectionString: url });

try {
  await client.connect();
  await client.query('BEGIN');
  await client.query('TRUNCATE TABLE tenants CASCADE');
  await client.query('DELETE FROM platform_admins');
  await client.query("DELETE FROM platform_settings WHERE id = 'global'");
  await client.query('COMMIT');
  console.log(`
Готово: таблицы очищены.

1) Перезапустите API:  npm run dev:api
2) Control Plane → http://localhost:3000/platform/login → bootstrap (первый админ) → «Все организации» → создайте tenant → пароль портала
3) Клиентская панель → /login с новым tenant id
4) (Рекомендуется) Увеличьте NEXT_PUBLIC_SESSION_EPOCH в apps/web/.env.local и перезапустите Next — сброс сессий в браузере.
`);
} catch (e) {
  await client.query('ROLLBACK').catch(() => {});
  console.error(e);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
