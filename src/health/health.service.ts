import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@Injectable()
export class HealthService {
  constructor(@InjectConnection() private connection: Connection) {}

  async check() {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        database: 'unknown',
        cache: 'unknown',
      },
    };

    try {
      const mongoReadyState = 1;
      const isDatabaseConnected = this.connection.readyState === mongoReadyState;
      
      if (isDatabaseConnected) {
        health.services.database = 'connected';
      } else {
        health.services.database = 'disconnected';
        health.status = 'degraded';
      }

      health.services.cache = 'connected';

      if (health.status !== 'ok') {
        throw new ServiceUnavailableException(health);
      }

      return health;
    } catch (error) {
      throw new ServiceUnavailableException({
        ...health,
        status: 'error',
        error: error.message,
      });
    }
  }
}
