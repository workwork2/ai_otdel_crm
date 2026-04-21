import { BadRequestException, Body, Controller, Post, UseGuards } from '@nestjs/common';
import { SuperOrJwtGuard } from '../auth/super-or-jwt.guard';
import { StoreService } from '../store/store.service';
import type { TenantStatus } from '../store/seed/super.seed';

@Controller('v1/platform')
@UseGuards(SuperOrJwtGuard)
export class PlatformController {
  constructor(private readonly store: StoreService) {}

  @Post('tenants')
  createTenant(
    @Body()
    body: {
      name?: string;
      slug?: string;
      planKey?: string;
      status?: TenantStatus;
    }
  ) {
    const name = String(body?.name ?? '').trim();
    const slug = String(body?.slug ?? '').trim();
    const planKey = String(body?.planKey ?? 'trial').trim();
    if (!name) throw new BadRequestException('Укажите название организации');
    if (!slug) throw new BadRequestException('Укажите slug (латиница, например my-shop)');
    if (name.length > 200) throw new BadRequestException('Название слишком длинное (макс. 200 символов)');
    if (slug.length > 128) throw new BadRequestException('Slug слишком длинный (макс. 128 символов до нормализации)');
    return this.store.createTenantOrganization({
      name,
      slug,
      planKey,
      status: body?.status,
    });
  }
}
