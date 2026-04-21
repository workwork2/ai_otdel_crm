import { Controller, Get } from '@nestjs/common';
import { StoreService } from '../store/store.service';

@Controller('v1')
export class PublicController {
  constructor(private readonly store: StoreService) {}

  @Get('health')
  health() {
    return { ok: true, service: 'linearize-api' };
  }

  @Get('docs/subscriptions')
  subscriptionDocs() {
    return { plans: this.store.getSubscriptionPlans() };
  }
}
