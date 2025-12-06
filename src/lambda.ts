import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import * as express from 'express';
import { APIGatewayProxyHandler } from 'aws-lambda';
import * as awsServerlessExpress from 'aws-serverless-express';

let cachedServer: any;

async function bootstrapServer() {
  if (!cachedServer) {
    const expressApp = express();
    const adapter = new ExpressAdapter(expressApp);
    
    const app = await NestFactory.create(AppModule, adapter, {
      logger: ['error', 'warn'], // Reduce logging overhead
      abortOnError: false,
    });
    
    app.enableCors();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
    cachedServer = awsServerlessExpress.createServer(expressApp);
  }
  return cachedServer;
}

export const handler: APIGatewayProxyHandler = async (event, context) => {
  // Prevent Lambda from waiting for event loop to be empty
  context.callbackWaitsForEmptyEventLoop = false;
  
  const server = await bootstrapServer();
  return awsServerlessExpress.proxy(server, event, context, 'PROMISE').promise;
};

