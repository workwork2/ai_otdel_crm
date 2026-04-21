import { join } from 'path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { MailModule } from './mail/mail.module';
import { PlatformController } from './platform/platform.controller';
import { PublicController } from './public/public.controller';
import { StoreModule } from './store/store.module';
import { SuperController } from './super/super.controller';
import { TenantController } from './tenant/tenant.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [join(__dirname, '..', '.env'), '.env'],
    }),
    DatabaseModule,
    MailModule,
    StoreModule,
    AuthModule,
    AiModule,
  ],
  controllers: [PublicController, TenantController, SuperController, PlatformController],
})
export class AppModule {}
