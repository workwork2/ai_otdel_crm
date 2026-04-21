import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthedRequest, SuperOrJwtGuard } from './super-or-jwt.guard';

@Controller('v1/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get('platform/status')
  platformStatus() {
    return this.auth.platformStatus();
  }

  @Post('platform/bootstrap')
  async bootstrap(@Body() body: { email?: string; password?: string }) {
    const email = String(body?.email ?? '');
    const password = String(body?.password ?? '');
    return this.auth.bootstrap(email, password);
  }

  @Post('platform/login')
  login(@Body() body: { email?: string; password?: string }) {
    return this.auth.login(String(body?.email ?? ''), String(body?.password ?? ''));
  }

  @Get('platform/me')
  @UseGuards(SuperOrJwtGuard)
  me(@Req() req: AuthedRequest) {
    if (req.superAuthMode === 'jwt' && req.platformAdmin) {
      return { ok: true, mode: 'jwt', email: req.platformAdmin.email };
    }
    return { ok: true, mode: 'api-key' };
  }

  @Post('tenant/login')
  tenantLogin(@Body() body: { tenantId?: string; password?: string }) {
    return this.auth.tenantLogin(String(body?.tenantId ?? ''), String(body?.password ?? ''));
  }

  @Post('tenant/exchange-code')
  tenantExchangeCode(@Body() body: { code?: string }) {
    return this.auth.exchangeTenantImpersonationCode(String(body?.code ?? ''));
  }
}
