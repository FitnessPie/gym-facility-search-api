import { NestFactory } from '@nestjs/core';
import { FacilitiesModule } from './facilities/facilities.module';
import { AuthModule } from './auth/auth.module';
import { FacilitiesService } from './facilities/facilities.service';
import { AuthService } from './auth/auth.service';
import { APIGatewayProxyHandler } from 'aws-lambda';

// ❌ DON'T DO THIS - Too much duplication
// This is for educational purposes only

// Lambda 1: Facilities endpoints
export const facilitiesHandler: APIGatewayProxyHandler = async (event) => {
  const app = await NestFactory.createApplicationContext(FacilitiesModule);
  const service = app.get(FacilitiesService);
  
  if (event.httpMethod === 'GET' && !event.pathParameters?.id) {
    const result = await service.getFacilities(event.queryStringParameters as any);
    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  }
  
  if (event.httpMethod === 'GET' && event.pathParameters?.id) {
    const result = await service.getFacilityById(event.pathParameters.id);
    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  }
  
  return { statusCode: 404, body: 'Not Found' };
};

// Lambda 2: Auth endpoints
export const authHandler: APIGatewayProxyHandler = async (event) => {
  const app = await NestFactory.createApplicationContext(AuthModule);
  const service = app.get(AuthService);
  
  if (event.httpMethod === 'POST' && event.path === '/auth/login') {
    const body = JSON.parse(event.body || '{}');
    const result = await service.login(body);
    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  }
  
  return { statusCode: 404, body: 'Not Found' };
};

// ❌ Problems with this approach:
// 1. Duplicate NestFactory.create() calls
// 2. Each Lambda has separate MongoDB connection
// 3. No shared caching
// 4. More code to maintain
// 5. Harder to test
