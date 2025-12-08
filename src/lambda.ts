import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { Server } from 'http';
import { Context, APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import express, { Express } from 'express';
import serverlessExpress from '@codegenie/serverless-express';

let cachedServer: Server;

async function bootstrap(): Promise<Express> {
  const expressApp = express();
  
  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressApp),
    { 
      logger: ['error', 'warn', 'log'],
      abortOnError: false 
    }
  );

  const logger = new Logger('Lambda');

  app.setGlobalPrefix('api/v1');
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

  await app.init();
  logger.log('NestJS application initialized for Lambda');

  return expressApp;
}

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context,
): Promise<APIGatewayProxyResult> => {
  if (!cachedServer) {
    const expressApp = await bootstrap();
    cachedServer = serverlessExpress({ app: expressApp });
  }
  
  return cachedServer(event, context);
};
