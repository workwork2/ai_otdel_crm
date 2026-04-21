import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Если задан TENANT_API_KEY — требуем заголовок X-Api-Key для маршрутов тенанта.
 */
@Injectable()
export class TenantApiGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('TENANT_API_KEY');
    if (!expected) return true;
    const req = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined> }>();
    const key = req.headers['x-api-key'];
    if (key !== expected) {
      throw new UnauthorizedException('Invalid X-Api-Key');
    }
    return true;
  }
}
