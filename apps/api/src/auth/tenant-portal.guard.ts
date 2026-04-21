import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { StoreService } from '../store/store.service';

/**
 * Доступ к /v1/tenant/:tenantId/*: JWT роли tenant_portal (после входа) или глобальный X-Api-Key (M2M).
 * Организация должна существовать в БД — после сброса БД старый JWT не даёт доступа.
 */
@Injectable()
export class TenantPortalGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly store: StoreService
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      params: { tenantId?: string };
      headers: Record<string, string | string[] | undefined>;
    }>();
    const tenantId = req.params?.tenantId;
    if (!tenantId) throw new UnauthorizedException('tenantId required');

    const globalKey = this.config.get<string>('TENANT_API_KEY')?.trim();
    if (globalKey) {
      const key = req.headers['x-api-key'];
      const k = Array.isArray(key) ? key[0] : key;
      if (k === globalKey) {
        if (!this.store.tenantExists(tenantId)) {
          throw new UnauthorizedException('Организация не найдена');
        }
        return true;
      }
    }

    const authRaw = req.headers.authorization;
    const auth = Array.isArray(authRaw) ? authRaw[0] : authRaw;
    if (!auth?.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        globalKey
          ? 'Нужен X-Api-Key или вход в панель организации (JWT)'
          : 'Войдите в панель организации или задайте TENANT_API_KEY на сервере для машинного доступа'
      );
    }
    try {
      const payload = this.jwt.verify<{ sub?: string; role?: string }>(auth.slice(7));
      if (payload.role !== 'tenant_portal' || payload.sub !== tenantId) {
        throw new UnauthorizedException('Токен не относится к этой организации');
      }
      if (!this.store.tenantExists(tenantId)) {
        throw new UnauthorizedException('Организация не найдена — войдите снова');
      }
      return true;
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      throw new UnauthorizedException('Неверный или просроченный токен');
    }
  }
}
