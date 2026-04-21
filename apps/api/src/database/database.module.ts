import { Global, Inject, Injectable, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { DRIZZLE_DB, PG_POOL, type AppDatabase } from './drizzle.tokens';
import { schema } from './schema';

@Injectable()
class DatabaseShutdownHook implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /** После всех onModuleDestroy (в т.ч. flush в StoreService). */
  async onApplicationShutdown() {
    await this.pool.end();
  }
}

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      useFactory: (config: ConfigService) => {
        const url = config.getOrThrow<string>('DATABASE_URL');
        return new Pool({
          connectionString: url,
          max: Number(config.get<string>('PG_POOL_MAX') ?? 20),
        });
      },
      inject: [ConfigService],
    },
    {
      provide: DRIZZLE_DB,
      useFactory: (pool: Pool): AppDatabase => drizzle(pool, { schema }),
      inject: [PG_POOL],
    },
    DatabaseShutdownHook,
  ],
  exports: [DRIZZLE_DB, PG_POOL],
})
export class DatabaseModule {}
