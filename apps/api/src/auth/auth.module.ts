import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SuperOrJwtGuard } from './super-or-jwt.guard';
import { TenantPortalGuard } from './tenant-portal.guard';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || 'dev-only-set-JWT_SECRET-in-production',
        signOptions: { expiresIn: 60 * 60 * 24 * 7 },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, SuperOrJwtGuard, TenantPortalGuard],
  exports: [AuthService, SuperOrJwtGuard, TenantPortalGuard, JwtModule],
})
export class AuthModule {}
