import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.warn(
    'drizzle-kit: задайте DATABASE_URL в apps/api/.env (или окружении) для команд push/migrate/introspect'
  );
}

export default defineConfig({
  schema: './src/database/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    // generate не ходит в БД; push/migrate — нужен реальный DATABASE_URL в .env
    url: url || 'postgresql://127.0.0.1:5432/postgres',
  },
  strict: true,
});
