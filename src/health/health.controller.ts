import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({
    summary: 'Health check',
    description: 'Check if the API is running and all dependencies are healthy',
  })
  @ApiResponse({
    status: 200,
    description: 'API is healthy',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        timestamp: { type: 'string', example: '2025-11-26T00:00:00.000Z' },
        uptime: { type: 'number', example: 12345.67 },
        services: {
          type: 'object',
          properties: {
            database: { type: 'string', example: 'connected' },
            cache: { type: 'string', example: 'connected' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 503,
    description: 'API is unhealthy',
  })
  async check() {
    return this.healthService.check();
  }
}
