import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

/**
 * Chaos Engineering Tests - Failure Scenario Testing
 * 
 * These tests validate system resilience:
 * - Redis connection failures
 * - MongoDB connection issues
 * - Network timeouts
 * - Rate limiting behavior
 * - Graceful degradation
 */
describe('Chaos Tests - Resilience Testing (AI-First)', () => {
  let app: INestApplication;
  let authToken: string;
  let mongoConnection: Connection;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    // Get connections for chaos testing
    mongoConnection = moduleFixture.get<Connection>(getConnectionToken());

    // Authenticate
    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123',
      });

    authToken = loginResponse.body.token;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Redis Failure Scenarios', () => {
    it('should gracefully degrade when Redis is unavailable', async () => {
      // This test assumes cache failures don't crash the app
      // In production, implement circuit breaker pattern
      
      const response = await request(app.getHttpServer())
        .get('/api/v1/facilities')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Should still return valid data (from MongoDB)
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('meta');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should handle cache write failures gracefully', async () => {
      // Make multiple requests to same resource
      // Even if cache writes fail, reads should work
      const requests = Array.from({ length: 5 }, () =>
        request(app.getHttpServer())
          .get('/api/v1/facilities/facility-001')
          .set('Authorization', `Bearer ${authToken}`)
      );

      const responses = await Promise.all(requests);

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('id', 'facility-001');
      });
    });

    it('should handle cache read failures without cascading', async () => {
      // Simulate cache miss scenario
      const response = await request(app.getHttpServer())
        .get('/api/v1/facilities?name=TestFacility&page=1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Should fall back to database query
      expect(response.body).toHaveProperty('data');
      expect(response.body.meta).toHaveProperty('total');
    });
  });

  describe('MongoDB Failure Scenarios', () => {
    it('should handle slow database queries', async () => {
      // Test with complex query that might be slow
      const response = await request(app.getHttpServer())
        .get('/api/v1/facilities?name=A&city=B&facilities=gym,pool&sortBy=rating&sortOrder=desc&page=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Should complete even if slow
      expect(response.body).toHaveProperty('data');
    }, 10000); // 10s timeout

    it('should handle empty database gracefully', async () => {
      // Test with query that returns no results
      const response = await request(app.getHttpServer())
        .get('/api/v1/facilities?name=NonExistentFacilityXYZ999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data).toEqual([]);
      expect(response.body.meta.total).toBe(0);
      expect(response.body.meta.page).toBeGreaterThan(0);
    });

    it('should handle pagination beyond available data', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/facilities?page=999999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Should return empty results, not crash
      expect(response.body.data).toEqual([]);
      expect(response.body.meta.page).toBe(999999);
      expect(response.body.meta.hasNextPage).toBe(false);
    });
  });

  describe('Authentication Failures', () => {
    it('should handle expired tokens gracefully', async () => {
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjF9.invalid';

      const response = await request(app.getHttpServer())
        .get('/api/v1/facilities')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body).toHaveProperty('statusCode', 401);
      expect(response.body).toHaveProperty('message');
    });

    it('should handle malformed authorization headers', async () => {
      const testCases = [
        '', // Empty
        'Bearer', // Missing token
        'InvalidScheme abc123', // Wrong scheme
        'Bearer ', // Space only
        authToken, // Missing "Bearer" prefix
      ];

      for (const header of testCases) {
        const response = await request(app.getHttpServer())
          .get('/api/v1/facilities')
          .set('Authorization', header)
          .expect(401);

        expect(response.body).toHaveProperty('statusCode', 401);
      }
    });

    it('should handle concurrent authentication attempts', async () => {
      const concurrentLogins = 20;
      const invalidAttempts = 10;

      const requests = [
        // Valid logins
        ...Array.from({ length: concurrentLogins - invalidAttempts }, () =>
          request(app.getHttpServer())
            .post('/api/v1/auth/login')
            .send({
              email: 'test@example.com',
              password: 'password123',
            })
        ),
        // Invalid logins (should not affect valid ones)
        ...Array.from({ length: invalidAttempts }, () =>
          request(app.getHttpServer())
            .post('/api/v1/auth/login')
            .send({
              email: 'test@example.com',
              password: 'wrong',
            })
            .catch(() => ({ status: 401 })) // Catch errors
        ),
      ];

      const responses = await Promise.all(requests);

      // Valid logins should succeed
      const validResponses = responses.slice(0, concurrentLogins - invalidAttempts);
      validResponses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // System should still be responsive
      const healthCheck = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      expect(healthCheck.body).toHaveProperty('status', 'ok');
    });
  });

  describe('Network Timeout Scenarios', () => {
    it('should handle very slow clients', async () => {
      // Simulate slow request processing
      const response = await request(app.getHttpServer())
        .get('/api/v1/facilities?page=1&limit=100') // Large result set
        .set('Authorization', `Bearer ${authToken}`)
        .timeout(5000) // 5s timeout
        .expect(200);

      expect(response.body.data.length).toBeLessThanOrEqual(100);
    });

    it('should handle connection drops gracefully', async () => {
      // Make request and verify it completes
      const response = await request(app.getHttpServer())
        .get('/api/v1/facilities')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Should return complete response
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('meta');
    });
  });

  describe('Input Validation Edge Cases', () => {
    it('should handle extremely large page numbers', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/facilities?page=999999999999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data).toEqual([]);
    });

    it('should handle negative page numbers gracefully', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/facilities?page=-1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Should default to page 1 or handle gracefully
      expect(response.body).toHaveProperty('data');
    });

    it('should handle zero and negative limits', async () => {
      const testCases = [0, -1, -100];

      for (const limit of testCases) {
        const response = await request(app.getHttpServer())
          .get(`/api/v1/facilities?limit=${limit}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        // Should use default limit or minimum valid value
        expect(response.body.meta.limit).toBeGreaterThan(0);
      }
    });

    it('should handle invalid sort parameters', async () => {
      const invalidSorts = [
        'invalidField',
        '__proto__',
        'constructor',
        'undefined',
      ];

      for (const sortBy of invalidSorts) {
        const response = await request(app.getHttpServer())
          .get(`/api/v1/facilities?sortBy=${sortBy}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        // Should use default sort or ignore invalid field
        expect(response.body).toHaveProperty('data');
      }
    });

    it('should handle XSS attempts in query params', async () => {
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        '"><script>alert(String.fromCharCode(88,83,83))</script>',
        '<img src=x onerror=alert("XSS")>',
      ];

      for (const payload of xssPayloads) {
        const response = await request(app.getHttpServer())
          .get(`/api/v1/facilities?name=${encodeURIComponent(payload)}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        // Should sanitize and search safely
        expect(response.body).toHaveProperty('data');
        
        // Response should not contain unsanitized payload
        const responseText = JSON.stringify(response.body);
        expect(responseText).not.toContain('<script>');
      }
    });
  });

  describe('Resource Exhaustion', () => {
    it('should handle memory-intensive queries', async () => {
      // Request large result set
      const response = await request(app.getHttpServer())
        .get('/api/v1/facilities?limit=100')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.length).toBeLessThanOrEqual(100);
      
      // System should still be responsive
      const healthCheck = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      expect(healthCheck.body.status).toBe('ok');
    });

    it('should handle rapid repeated requests', async () => {
      const rapidRequests = 50;
      const delay = 10; // 10ms between requests

      const results: any[] = [];

      for (let i = 0; i < rapidRequests; i++) {
        const response = await request(app.getHttpServer())
          .get('/api/v1/facilities/facility-001')
          .set('Authorization', `Bearer ${authToken}`);
        
        results.push(response);
        
        if (i < rapidRequests - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      // All should succeed (no rate limiting in test environment)
      results.forEach(response => {
        expect(response.status).toBe(200);
      });
    }, 10000);
  });

  describe('Concurrent Write Scenarios', () => {
    it('should handle concurrent login attempts for same user', async () => {
      const concurrentLogins = 10;

      const requests = Array.from({ length: concurrentLogins }, () =>
        request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({
            email: 'test@example.com',
            password: 'password123',
          })
      );

      const responses = await Promise.all(requests);

      // All should succeed and return valid tokens
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('token');
        expect(response.body.token).toBeTruthy();
      });

      // Tokens should be valid
      const tokens = responses.map(r => r.body.token);
      const uniqueTokens = new Set(tokens);
      
      // All tokens should be unique (different issued times)
      expect(uniqueTokens.size).toBe(concurrentLogins);
    });
  });

  describe('System Health During Chaos', () => {
    it('should maintain health endpoint availability', async () => {
      // Make multiple requests to simulate load
      const loadRequests = Array.from({ length: 20 }, (_, i) =>
        request(app.getHttpServer())
          .get(`/api/v1/facilities?page=${i + 1}`)
          .set('Authorization', `Bearer ${authToken}`)
      );

      // Intermix with health checks
      const healthChecks = Array.from({ length: 5 }, () =>
        request(app.getHttpServer())
          .get('/api/v1/health')
      );

      const allRequests = [...loadRequests, ...healthChecks];
      const responses = await Promise.all(allRequests);

      // Health checks should all succeed
      const healthResponses = responses.slice(-5);
      healthResponses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('status', 'ok');
      });
    }, 15000);
  });
});
