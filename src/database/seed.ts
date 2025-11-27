import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SeedService } from './seed.service';

async function bootstrap() {
  try {
    const app = await NestFactory.createApplicationContext(AppModule);
    const seedService = app.get(SeedService);

    await seedService.seed();

    await app.close();
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

bootstrap();
