import { Injectable, ServiceUnavailableException, Inject } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class HealthService {
  constructor(
    @InjectConnection() private connection: Connection,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async check() {
    const startTime = Date.now();
    
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      responseTime: 0,
      services: {
        database: {
          status: 'unknown',
          responseTime: 0,
        },
        cache: {
          status: 'unknown',
          responseTime: 0,
        },
      },
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
    };

    try {
      // Check MongoDB
      const dbStartTime = Date.now();
      const mongoReadyState = 1;
      const isDatabaseConnected = this.connection.readyState === mongoReadyState;

      if (isDatabaseConnected) {
        // Perform actual ping to verify connection
        if (this.connection.db) {
          await this.connection.db.admin().ping();
        }
        health.services.database.status = 'connected';
        health.services.database.responseTime = Date.now() - dbStartTime;
      } else {
        health.services.database.status = 'disconnected';
        health.status = 'degraded';
      }

      // Check Redis/Cache
      const cacheStartTime = Date.now();
      try {
        const testKey = '__health_check__';
        await this.cacheManager.set(testKey, 'ok', 5000);
        const result = await this.cacheManager.get(testKey);
        await this.cacheManager.del(testKey);

        if (result === 'ok') {
          health.services.cache.status = 'connected';
          health.services.cache.responseTime = Date.now() - cacheStartTime;
        } else {
          health.services.cache.status = 'degraded';
          health.status = 'degraded';
        }
      } catch (error) {
        health.services.cache.status = 'disconnected';
        health.status = 'degraded';
      }

      health.responseTime = Date.now() - startTime;

      if (health.status !== 'ok') {
        throw new ServiceUnavailableException(health);
      }

      return health;
    } catch (error) {
      health.responseTime = Date.now() - startTime;
      throw new ServiceUnavailableException({
        ...health,
        status: 'error',
        error: error.message,
      });
    }
  }
}
