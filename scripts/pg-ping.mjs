#!/usr/bin/env node
/**
 * Проверка TCP к PostgreSQL по DATABASE_URL (или apps/api/.env).
 * Пропуск: SKIP_DB_CHECK=1 или хост не localhost.
 */
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadDatabaseUrlFromApiEnv() {
  if (process.env.DATABASE_URL?.trim()) return;
  const envPath = path.join(__dirname, '..', 'apps', 'api', '.env');
  try {
    const raw = fs.readFileSync(envPath, 'utf8');
    for (const line of raw.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq === -1) continue;
      const key = t.slice(0, eq).trim();
      if (key !== 'DATABASE_URL') continue;
      let val = t.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (val) process.env.DATABASE_URL = val;
      break;
    }
  } catch {
    /* нет файла — ниже дефолт */
  }
}

function parseConn(urlStr) {
  try {
    const u = new URL(urlStr);
    const host = u.hostname;
    const port = u.port ? Number(u.port) : 5432;
    return { host, port };
  } catch {
    return null;
  }
}

if (process.env.SKIP_DB_CHECK === '1') {
  process.exit(0);
}

loadDatabaseUrlFromApiEnv();

const urlRaw = (process.env.DATABASE_URL || '').trim();
let host = process.env.PG_PING_HOST;
let port = process.env.PG_PING_PORT ? Number(process.env.PG_PING_PORT) : undefined;

if (urlRaw) {
  const parsed = parseConn(urlRaw);
  if (parsed) {
    const local =
      parsed.host === 'localhost' ||
      parsed.host === '127.0.0.1' ||
      parsed.host === '::1' ||
      parsed.host === '[::1]';
    if (!local) {
      process.exit(0);
    }
    if (!host) host = parsed.host === '[::1]' ? '::1' : parsed.host;
    if (!port) port = parsed.port;
  }
}

host = host || '127.0.0.1';
port = port ?? 5432;

/** Один стек IPv4 — меньше сюрпризов с localhost → ::1. */
const connectHost =
  host === 'localhost' || host === '::1' || host === '[::1]' ? '127.0.0.1' : host;

const tryConnect = () =>
  new Promise((resolve, reject) => {
    const s = net.connect({ host: connectHost, port, family: 4 }, () => {
      s.end();
      resolve();
    });
    s.setTimeout(2500, () => {
      s.destroy();
      reject(new Error('timeout'));
    });
    s.on('error', reject);
  });

try {
  await tryConnect();
  process.exit(0);
} catch {
  console.error(`
PostgreSQL не отвечает на ${connectHost}:${port} (из DATABASE_URL / apps/api/.env).

1) Запустите Docker Desktop, затем из корня репозитория:
   npm run postgres:up

2) Либо установите PostgreSQL локально. Пароль в DATABASE_URL должен совпадать с пользователем в БД.

Удалённая БД:  SKIP_DB_CHECK=1 npm run dev:api
`);
  process.exit(1);
}
