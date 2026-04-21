import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiModule } from './ai/ai.module';
import { PublicController } from './public/public.controller';
import { StoreModule } from './store/store.module';
import { SuperController } from './super/super.controller';
import { TenantController } from './tenant/tenant.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    StoreModule,
    AiModule,
  ],
  controllers: [PublicController, TenantController, SuperController],
})
export class AppModule {}
