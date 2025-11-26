import { IsString, IsNumber, IsEnum, Min, Max, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @Min(1)
  @Max(65535)
  @Transform(({ value }) => parseInt(value, 10))
  PORT: number = 3000;

  @IsString()
  @IsNotEmpty()
  API_PREFIX: string = 'api/v1';

  @IsString()
  @IsNotEmpty()
  MONGODB_URI: string;

  @IsString()
  @IsNotEmpty()
  REDIS_HOST: string = 'localhost';

  @IsNumber()
  @Min(1)
  @Max(65535)
  @Transform(({ value }) => parseInt(value, 10))
  REDIS_PORT: number = 6379;

  @IsNumber()
  @Min(1)
  @Transform(({ value }) => parseInt(value, 10))
  REDIS_TTL: number = 3600;

  @IsString()
  @IsNotEmpty()
  JWT_SECRET: string;

  @IsString()
  @IsNotEmpty()
  JWT_EXPIRATION: string = '3600s';

  @IsNumber()
  @Min(1)
  @Transform(({ value }) => parseInt(value, 10))
  THROTTLE_TTL: number = 60;

  @IsNumber()
  @Min(1)
  @Transform(({ value }) => parseInt(value, 10))
  THROTTLE_LIMIT: number = 100;

  @IsNumber()
  @Min(1)
  @Transform(({ value }) => parseInt(value, 10))
  DEFAULT_PAGE_SIZE: number = 20;

  @IsNumber()
  @Min(1)
  @Max(1000)
  @Transform(({ value }) => parseInt(value, 10))
  MAX_PAGE_SIZE: number = 100;
}
