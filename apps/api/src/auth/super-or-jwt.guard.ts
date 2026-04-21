import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { eq } from 'drizzle-orm';
import { Request } from 'express';
import { DRIZZLE_DB, type AppDatabase } from '../database/drizzle.tokens';
import { platformAdmins } from '../database/schema';

export type PlatformAdminPrincipal = { id: string; email: string };

export type AuthedRequest = Request & {
  platformAdmin?: PlatformAdminPrincipal | null;
  superAuthMode?: 'api-key' | 'jwt';
};

@Injectable()
export class SuperOrJwtGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    @Inject(DRIZZLE_DB) private readonly db: AppDatabase
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const expected = this.config.get<string>('SUPER_ADMIN_KEY');
    const headerKey = req.headers['x-super-admin-key'];
    if (expected && headerKey === expected) {
      req.superAuthMode = 'api-key';
      req.platformAdmin = null;
      return true;
    }
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ')) {
      try {
        const payload = this.jwt.verify<{ sub: string }>(auth.slice(7));
        const [admin] = await this.db
          .select({ id: platformAdmins.id, email: platformAdmins.email })
          .from(platformAdmins)
          .where(eq(platformAdmins.id, payload.sub))
          .limit(1);
        if (admin) {
          req.superAuthMode = 'jwt';
          req.platformAdmin = admin;
          return true;
        }
      } catch {
        /* fall through */
      }
    }
    throw new UnauthorizedException(
      'Нужен JWT главного админа (Authorization: Bearer) или заголовок X-Super-Admin-Key'
    );
  }
}
