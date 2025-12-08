import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  const apiPrefix = configService.get('API_PREFIX');
  app.setGlobalPrefix(apiPrefix);
  app.enableCors();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Facility Search API')
    .setDescription(
      `Production-ready RESTful API for searching and filtering fitness facilities.

**Features:**
- 🔍 Advanced search with name and amenity filtering
- 📊 Paginated results with customizable sorting
- ⚡ Redis caching for optimal performance (36x speedup measured)
- 🔐 JWT authentication
- 🛡️ Rate limiting (100 requests/60 seconds)
- 🏥 Health monitoring for all services

**Performance:**
- Optimized for 100,000+ facilities
- P95 latency < 500ms
- < 0.5% error rate SLO

**Amenity Matching Modes:**
- \`all\`: Facility must have ALL specified amenities
- \`any\`: Facility must have AT LEAST ONE amenity
- \`exact\`: Facility must have EXACTLY these amenities (no more, no less)
      `
    )
    .setVersion('1.0')
    .setContact('pH-7', 'https://github.com/pH-7', 'hi@ph7.me')
    .setLicense('MIT', 'https://opensource.org/licenses/MIT')
    .addServer('http://localhost:3000', 'Development')
    .addServer('https://api.example.com', 'Production')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('facilities', 'Facility search and retrieval operations')
    .addTag('auth', 'Authentication and authorization')
    .addTag('health', 'Health check and system status')
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig, {
    deepScanRoutes: true,
    operationIdFactory: (controllerKey: string, methodKey: string) => methodKey,
  });

  // Add custom CSS for better Swagger UI
  SwaggerModule.setup('api/docs', app, swaggerDocument, {
    customSiteTitle: 'Facility Search API Documentation',
    customfavIcon: 'https://nestjs.com/img/logo-small.svg',
    customCss: '.swagger-ui .topbar { display: none }',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      tryItOutEnabled: true,
    },
  });

  const port = configService.get('PORT');
  await app.listen(port);

  logger.log(`Application is running on: http://localhost:${port}/${apiPrefix}`);
  logger.log(`📚 Swagger documentation: http://localhost:${port}/api/docs`);
}

bootstrap();
