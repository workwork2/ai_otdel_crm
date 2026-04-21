import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export type TenantSmtpOverride = {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
  smtpFrom?: string;
};

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    const host = this.config.get<string>('SMTP_HOST')?.trim();
    const user = this.config.get<string>('SMTP_USER')?.trim();
    const pass = this.config.get<string>('SMTP_PASS')?.trim();
    return !!(host && user && pass);
  }

  isTenantSmtpConfigured(t: TenantSmtpOverride | null | undefined): boolean {
    if (!t) return false;
    return !!(t.smtpHost?.trim() && t.smtpUser?.trim() && t.smtpPass?.trim());
  }

  /** Адрес отправителя без пароля. */
  getFrom(): string | null {
    if (!this.isConfigured()) return null;
    const explicit = this.config.get<string>('SMTP_FROM')?.trim();
    if (explicit) return explicit;
    const user = this.config.get<string>('SMTP_USER')?.trim();
    return user ? `AI Отдел <${user}>` : null;
  }

  /** 465 — implicit TLS (SMTPS); 587 — STARTTLS (secure должен быть false). */
  private smtpConnectionOptions(host: string, port: number, secureFlag: boolean, user: string, pass: string) {
    const implicitTls = port === 465;
    const startTlsPort = port === 587;
    const secure = implicitTls ? true : startTlsPort ? false : secureFlag;
    return {
      host: host.trim(),
      port,
      secure,
      auth: { user: user.trim(), pass: pass.trim() },
      requireTLS: startTlsPort,
      tls: { minVersion: 'TLSv1.2' as const },
      connectionTimeout: 25_000,
      greetingTimeout: 15_000,
      socketTimeout: 25_000,
    };
  }

  private getTransporter(): nodemailer.Transporter | null {
    if (!this.isConfigured()) return null;
    if (this.transporter) return this.transporter;
    const host = this.config.get<string>('SMTP_HOST')!.trim();
    const port = Number(this.config.get<string>('SMTP_PORT') ?? 465);
    const secureRaw = this.config.get<string>('SMTP_SECURE');
    const secureEnv = secureRaw !== 'false' && secureRaw !== '0';
    const user = this.config.get<string>('SMTP_USER')!.trim();
    const pass = this.config.get<string>('SMTP_PASS')!.trim();
    this.transporter = nodemailer.createTransport(
      this.smtpConnectionOptions(host, port, secureEnv, user, pass)
    );
    return this.transporter;
  }

  private createTenantTransporter(t: TenantSmtpOverride): nodemailer.Transporter {
    return nodemailer.createTransport(
      this.smtpConnectionOptions(
        t.smtpHost,
        t.smtpPort,
        t.smtpSecure,
        t.smtpUser,
        t.smtpPass
      )
    );
  }

  /**
   * Проверка логина к SMTP без отправки письма (для диагностики).
   */
  async verifySmtp(tenantSmtp?: TenantSmtpOverride | null): Promise<void> {
    const from = this.resolveFrom(tenantSmtp ?? null);
    let tr: nodemailer.Transporter | null = null;
    if (tenantSmtp && this.isTenantSmtpConfigured(tenantSmtp)) {
      tr = this.createTenantTransporter(tenantSmtp);
    } else {
      tr = this.getTransporter();
    }
    if (!tr || !from) throw new Error('SMTP не настроен');
    try {
      await tr.verify();
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string; response?: string };
      const code = String(e.code ?? '');
      const msg = String(e.message ?? err ?? '');
      const low = `${msg} ${String(e.response ?? '')}`.toLowerCase();
      if (code === 'EAUTH' || /535|authentication failed|invalid login/i.test(low)) {
        throw new Error(
          'SMTP verify: неверный логин или пароль (Mail.ru — только «пароль приложения»).'
        );
      }
      if (code === 'ECONNECTION' || code === 'ETIMEDOUT' || /econnrefused/i.test(low)) {
        throw new Error(
          `SMTP verify: нет соединения (${code || 'сеть'}). Порт 465 — SSL; 587 — без галочки «secure» в старых формах, на сервере выставляется STARTTLS автоматически.`
        );
      }
      throw new Error(msg.length > 350 ? `${msg.slice(0, 350)}…` : msg || 'verify failed');
    }
  }

  private resolveFrom(tenant?: TenantSmtpOverride | null): string | null {
    if (tenant && this.isTenantSmtpConfigured(tenant)) {
      if (tenant.smtpFrom?.trim()) return tenant.smtpFrom.trim();
      return `AI Отдел <${tenant.smtpUser.trim()}>`;
    }
    return this.getFrom();
  }

  /**
   * Отправка: при валидном tenant SMTP — через него, иначе глобальный SMTP из .env.
   */
  async sendMail(
    opts: { to: string; subject: string; text: string; html?: string },
    tenantSmtp?: TenantSmtpOverride | null
  ): Promise<void> {
    const from = this.resolveFrom(tenantSmtp ?? null);
    let t: nodemailer.Transporter | null = null;
    if (tenantSmtp && this.isTenantSmtpConfigured(tenantSmtp)) {
      t = this.createTenantTransporter(tenantSmtp);
    } else {
      t = this.getTransporter();
    }
    if (!t || !from) throw new Error('SMTP не настроен: укажите в интеграции Email или SMTP_* в API');
    try {
      await t.sendMail({
        from,
        to: opts.to,
        subject: opts.subject,
        text: opts.text,
        html: opts.html ?? opts.text.replace(/\n/g, '<br/>'),
      });
    } catch (err: unknown) {
      const e = err as { code?: string; responseCode?: number; message?: string; response?: string };
      const code = String(e.code ?? '');
      const msg = String(e.message ?? err ?? '');
      const low = `${msg} ${String(e.response ?? '')}`.toLowerCase();
      if (code === 'EAUTH' || /535|authentication failed|invalid login|bad credentials/i.test(low)) {
        throw new Error(
          'SMTP: ошибка входа. Проверьте логин и пароль (для Mail.ru — «пароль приложения», не пароль от почты).'
        );
      }
      if (code === 'ECONNECTION' || code === 'ETIMEDOUT' || /econnrefused/i.test(low)) {
        throw new Error(
          `SMTP: нет соединения с сервером (${code || 'сеть'}). Проверьте SMTP_HOST, порт и что хост доступен с машины API.`
        );
      }
      if (/certificate|self signed|unable to verify|ssl/i.test(low)) {
        throw new Error(
          'SMTP: ошибка TLS/SSL. Для порта 465 обычно SMTP_SECURE=true; для 587 — false и STARTTLS.'
        );
      }
      const short = msg.length > 400 ? `${msg.slice(0, 400)}…` : msg;
      throw new Error(short || 'Не удалось отправить письмо через SMTP');
    }
  }
}
