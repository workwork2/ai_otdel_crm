import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('SUPER_ADMIN_KEY');
    if (!expected) {
      throw new UnauthorizedException('SUPER_ADMIN_KEY is not configured on the server');
    }
    const req = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined> }>();
    const key = req.headers['x-super-admin-key'];
    if (key !== expected) {
      throw new UnauthorizedException('Invalid X-Super-Admin-Key');
    }
    return true;
  }
}
