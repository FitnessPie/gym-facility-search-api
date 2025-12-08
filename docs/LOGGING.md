# Adding Pino Logger

## Installation

```bash
yarn add nestjs-pino pino-http
yarn add -D pino-pretty
```

## Configuration

### 1. Update `app.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        customProps: (req, res) => ({
          context: 'HTTP',
        }),
        transport: {
          target: 'pino-pretty',
          options: {
            singleLine: true,
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
      },
    }),
    // ... other imports
  ],
})
export class AppModule {}
```

### 2. Update `main.ts`

```typescript
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  
  await app.listen(3000);
}
bootstrap();
```

### 3. Use in Services

```typescript
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class FacilitiesService {
  private readonly logger = new Logger(FacilitiesService.name);

  async findAll() {
    this.logger.log('Finding all facilities');
    // ... your code
  }
}
```

## Production Configuration

### Environment-Based Config

```typescript
// app.module.ts
LoggerModule.forRoot({
  pinoHttp: {
    level: process.env.NODE_ENV !== 'production' ? 'debug' : 'info',
    transport: process.env.NODE_ENV !== 'production' 
      ? {
          target: 'pino-pretty',
          options: {
            singleLine: true,
            colorize: true,
          },
        }
      : undefined, // No pretty-print in production (use JSON)
  },
}),
```

## Benefits

### Development (with pino-pretty)
```
[10:30:00.123] INFO (12345): Application started
    context: "Bootstrap"
```

### Production (JSON)
```json
{"level":30,"time":1733659800123,"pid":12345,"context":"Bootstrap","msg":"Application started"}
```

## CloudWatch Integration

```typescript
// For AWS Lambda/CloudWatch
import pino from 'pino';

const logger = pino({
  level: 'info',
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },
});
```

## Automatic Request Logging

Pino automatically logs:
- Request method, URL, status
- Response time
- User agent
- IP address

```json
{
  "level": 30,
  "time": 1733659800123,
  "req": {
    "method": "GET",
    "url": "/api/v1/facilities",
    "remoteAddress": "127.0.0.1"
  },
  "res": {
    "statusCode": 200
  },
  "responseTime": 45,
  "msg": "request completed"
}
```

## Performance Comparison

| Feature | NestJS Logger | Pino |
|---------|--------------|------|
| Speed | ~10ms per log | ~0.3ms per log |
| Async | No | Yes |
| JSON | No | Yes |
| Readable | Yes | With pino-pretty |
| Production | OK | Excellent |

## Recommendation

For this project:
- **Now (Development):** Keep NestJS built-in logger ✅
- **Before Production:** Switch to Pino
- **Interview:** Mention you know the difference and when to use each
