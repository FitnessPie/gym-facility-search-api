import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../app.module';
import { SeedService } from './seed.service';

async function bootstrap() {
  try {
    const app = await NestFactory.createApplicationContext(AppModule);
    const seedService = app.get(SeedService);

    await seedService.seed();

    await app.close();
  } catch (error) {
    const logger = new Logger('Seed');
    logger.error('Seeding failed:', error);
    process.exit(1);
  }
}

bootstrap();
