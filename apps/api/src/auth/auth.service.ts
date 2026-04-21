import { randomBytes } from 'crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { count, eq } from 'drizzle-orm';
import { DRIZZLE_DB, type AppDatabase } from '../database/drizzle.tokens';
import { platformAdmins } from '../database/schema';
import { StoreService } from '../store/store.service';

@Injectable()
export class AuthService {
  /** Одноразовые коды «Войти как» (~2 мин); не в БД — при рестарте незавершённые ссылки станут недействительны. */
  private readonly impersonationCodes = new Map<string, { tenantId: string; expiresAt: number }>();

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: AppDatabase,
    private readonly jwt: JwtService,
    private readonly store: StoreService
  ) {}

  async bootstrap(emailRaw: string, password: string) {
    const [{ value: n }] = await this.db.select({ value: count() }).from(platformAdmins);
    if (n > 0) {
      throw new BadRequestException('Главный админ уже создан. Используйте вход.');
    }
    const email = emailRaw.trim().toLowerCase();
    if (!email.includes('@')) throw new BadRequestException('Некорректный email');
    if (password.length < 8) {
      throw new BadRequestException('Пароль не короче 8 символов');
    }
    if (Buffer.byteLength(password, 'utf8') > 72) {
      throw new BadRequestException('Пароль слишком длинный (не более 72 байт в UTF-8)');
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const [admin] = await this.db.insert(platformAdmins).values({ email, passwordHash }).returning();
    const accessToken = await this.jwt.signAsync({ sub: admin.id, email: admin.email });
    return { accessToken, email: admin.email };
  }

  async platformStatus() {
    const [{ value: countAdmins }] = await this.db.select({ value: count() }).from(platformAdmins);
    return { needsBootstrap: countAdmins === 0 };
  }

  async login(emailRaw: string, password: string) {
    const email = emailRaw.trim().toLowerCase();
    if (!email) throw new BadRequestException('Укажите email');
    if (!password) throw new BadRequestException('Введите пароль');
    if (Buffer.byteLength(password, 'utf8') > 72) {
      throw new BadRequestException('Пароль слишком длинный (не более 72 байт в UTF-8)');
    }
    const [admin] = await this.db.select().from(platformAdmins).where(eq(platformAdmins.email, email)).limit(1);
    if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
      throw new UnauthorizedException('Неверный email или пароль');
    }
    const accessToken = await this.jwt.signAsync({ sub: admin.id, email: admin.email });
    return { accessToken, email: admin.email };
  }

  async tenantLogin(tenantIdRaw: string, password: string) {
    const tenantId = tenantIdRaw.trim();
    if (!tenantId) throw new BadRequestException('Укажите ID организации');
    if (!password) throw new BadRequestException('Введите пароль');
    const hash = this.store.getTenantPortalPasswordHash(tenantId);
    if (!hash) {
      throw new UnauthorizedException(
        'Пароль для панели не задан. Администратор платформы должен задать его в супер-админке.'
      );
    }
    if (!(await bcrypt.compare(password, hash))) {
      throw new UnauthorizedException('Неверный пароль');
    }
    const accessToken = await this.jwt.signAsync({
      sub: tenantId,
      role: 'tenant_portal',
    });
    return { accessToken, tenantId };
  }

  issueTenantImpersonationCode(tenantId: string): string {
    if (!this.store.tenantExists(tenantId)) {
      throw new NotFoundException('Организация не найдена');
    }
    const code = randomBytes(24).toString('base64url');
    this.impersonationCodes.set(code, { tenantId, expiresAt: Date.now() + 120_000 });
    return code;
  }

  async exchangeTenantImpersonationCode(codeRaw: string) {
    const code = codeRaw.trim();
    if (!code) throw new BadRequestException('Укажите code');
    const row = this.impersonationCodes.get(code);
    if (!row || row.expiresAt < Date.now()) {
      this.impersonationCodes.delete(code);
      throw new UnauthorizedException('Код недействителен или истёк');
    }
    this.impersonationCodes.delete(code);
    const accessToken = await this.jwt.signAsync({
      sub: row.tenantId,
      role: 'tenant_portal',
    });
    return { accessToken, tenantId: row.tenantId };
  }
}
