import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * FILE PURPOSE
 * ----------------------------------------------------------------------------
 * Thin wrapper around an `ioredis` client, injectable anywhere via
 * `RedisService`. Used today for permission caching (Phase 6); the same
 * client will later back rate limiting and short-lived data (Phase 19).
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  public client: Redis;

  constructor(private readonly config: ConfigService) {
    this.client = new Redis(this.config.get<string>('redis.url')!, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.client.connect();
      this.logger.log('Connected to Redis');
    } catch (error) {
      this.logger.error('Failed to connect to Redis', error as Error);
    }
  }

  onModuleDestroy(): void {
    this.client.disconnect();
  }

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }

  async setJson(
    key: string,
    value: unknown,
    ttlSeconds: number,
  ): Promise<void> {
    await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async delByPrefix(prefix: string): Promise<void> {
    const stream = this.client.scanStream({ match: `${prefix}*` });
    const keysToDelete: string[] = [];
    for await (const keys of stream) {
      keysToDelete.push(...(keys as string[]));
    }
    if (keysToDelete.length > 0) {
      await this.client.del(...keysToDelete);
    }
  }
}
