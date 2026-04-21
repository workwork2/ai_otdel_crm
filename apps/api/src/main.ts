import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const origins = process.env.CORS_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean);
  app.enableCors({
    origin: origins?.length ? origins : true,
    credentials: true,
  });
  const port = Number(process.env.PORT ?? 3333);
  await app.listen(port);
  console.log(`API listening on http://localhost:${port}`);
}

bootstrap();
