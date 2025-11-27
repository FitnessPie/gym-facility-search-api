import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import { CacheModule } from '@nestjs/cache-manager';
import * as redisStore from 'cache-manager-redis-store';
import { FacilitiesModule } from './facilities/facilities.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { validateEnvironment } from './config/environment.config';
import { SeedService } from './database/seed.service';
import { Facility, FacilitySchema } from './facilities/schemas/facility.schema';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: validateEnvironment,
      cache: true,
    }),

    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
      }),
      inject: [ConfigService],
    }),

    MongooseModule.forFeature([{ name: Facility.name, schema: FacilitySchema }]),

    // Cache module configuration
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        store: redisStore,
        host: configService.get<string>('REDIS_HOST'),
        port: configService.get<number>('REDIS_PORT'),
        ttl: configService.get<number>('REDIS_TTL'),
      }),
      inject: [ConfigService],
    }),

    // Rate limiting configuration
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const secondsToMilliseconds = 1000;
        const throttleTtlInSeconds = configService.get<number>('THROTTLE_TTL', 60);
        
        return [
          {
            ttl: throttleTtlInSeconds * secondsToMilliseconds,
            limit: configService.get<number>('THROTTLE_LIMIT', 100),
          },
        ];
      },
      inject: [ConfigService],
    }),

    FacilitiesModule,
    AuthModule,
    HealthModule,
  ],
  providers: [SeedService],
})
export class AppModule {}
