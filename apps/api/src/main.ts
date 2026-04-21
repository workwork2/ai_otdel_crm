import { existsSync } from 'fs';
import { resolve } from 'path';
import { config as loadEnv } from 'dotenv';
import { NestFactory } from '@nestjs/core';
import { runMigrationsIfEnabled } from './database/run-migrations';
import { AppModule } from './app.module';

/** Всегда читаем `apps/api/.env`, даже если процесс запущен из корня монорепозитория. */
const apiEnvPath = resolve(__dirname, '..', '.env');
if (existsSync(apiEnvPath)) {
  loadEnv({ path: apiEnvPath });
} else {
  loadEnv();
}

async function bootstrap() {
  await runMigrationsIfEnabled();
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  const origins = process.env.CORS_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean);
  app.enableCors({
    origin: origins?.length ? origins : true,
    credentials: true,
  });
  const port = Number(process.env.PORT ?? 3333);
  await app.listen(port);
  console.log(`API listening on http://localhost:${port}`);
  if (process.env.NODE_ENV !== 'production') {
    const g = !!process.env.GEMINI_API_KEY?.trim();
    const a = !!process.env.ANTHROPIC_API_KEY?.trim();
    console.log(`[env] AI keys loaded: GEMINI_API_KEY=${g}, ANTHROPIC_API_KEY=${a}`);
  }
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
