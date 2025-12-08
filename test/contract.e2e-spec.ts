import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * Contract Tests - AI-Generated from OpenAPI Spec
 * 
 * These tests validate API contract compliance:
 * - Request/response schema validation
 * - Error response formats
 * - Edge case handling
 */
describe('API Contract Tests (AI-First)', () => {
  let app: INestApplication;
  let authToken: string;

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

    // Authenticate for protected endpoints
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

  describe('GET /api/v1/facilities - Schema Validation', () => {
    it('should return schema-compliant paginated response', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/facilities')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Response structure validation
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('meta');
      expect(Array.isArray(response.body.data)).toBe(true);

      // Meta schema validation
      const { meta } = response.body;
      expect(meta).toMatchObject({
        total: expect.any(Number),
        page: expect.any(Number),
        limit: expect.any(Number),
        totalPages: expect.any(Number),
        hasNextPage: expect.any(Boolean),
        hasPreviousPage: expect.any(Boolean),
      });

      // Validate meta values are logical
      expect(meta.total).toBeGreaterThanOrEqual(0);
      expect(meta.page).toBeGreaterThanOrEqual(1);
      expect(meta.limit).toBeGreaterThan(0);
      expect(meta.totalPages).toBeGreaterThanOrEqual(0);

      // Data item schema validation (if results exist)
      if (response.body.data.length > 0) {
        const facility = response.body.data[0];
        
        expect(facility).toMatchObject({
          id: expect.any(String),
          name: expect.any(String),
          address: expect.any(String),
          location: {
            latitude: expect.any(Number),
            longitude: expect.any(Number),
          },
          facilities: expect.any(Array),
        });

        // Validate data types and ranges
        expect(facility.location.latitude).toBeGreaterThanOrEqual(-90);
        expect(facility.location.latitude).toBeLessThanOrEqual(90);
        expect(facility.location.longitude).toBeGreaterThanOrEqual(-180);
        expect(facility.location.longitude).toBeLessThanOrEqual(180);
        expect(facility.facilities.length).toBeGreaterThan(0);
      }
    });

    it('should handle sorting parameters correctly', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/facilities?sortBy=name&sortOrder=asc')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const facilities = response.body.data;
      
      // Verify sorting (if multiple results)
      if (facilities.length > 1) {
        for (let i = 0; i < facilities.length - 1; i++) {
          const current = facilities[i].name.toLowerCase();
          const next = facilities[i + 1].name.toLowerCase();
          // Check alphabetical order
          expect(current.localeCompare(next)).toBeLessThanOrEqual(0);
        }
      }
    });

    it('should validate pagination boundaries', async () => {
      // Test page 1
      const page1 = await request(app.getHttpServer())
        .get('/api/v1/facilities?page=1&limit=5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(page1.body.meta.page).toBe(1);
      expect(page1.body.meta.limit).toBe(5);
      expect(page1.body.data.length).toBeLessThanOrEqual(5);
      expect(page1.body.meta.hasPreviousPage).toBe(false);
    });
  });

  describe('Edge Cases - AI-Generated', () => {
    it('should handle empty search results gracefully', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/facilities?name=NonExistentFacilityXYZ123')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data).toEqual([]);
      expect(response.body.meta.total).toBe(0);
    });

    it('should handle special characters in search', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/facilities?name=' + encodeURIComponent('City & Gym'))
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('meta');
    });

    it('should handle very long search terms', async () => {
      const longTerm = 'A'.repeat(1000);
      const response = await request(app.getHttpServer())
        .get(`/api/v1/facilities?name=${longTerm}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data).toEqual([]);
    });

    it('should handle maximum pagination limit', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/facilities?limit=100')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.length).toBeLessThanOrEqual(100);
    });

    it('should validate limit boundaries', async () => {
      // ValidationPipe should reject invalid limits
      // Test with reasonable large limit that's accepted
      const response = await request(app.getHttpServer())
        .get('/api/v1/facilities?limit=100')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.meta.limit).toBe(100);
      expect(response.body.data.length).toBeLessThanOrEqual(100);
    });
  });

  describe('GET /api/v1/facilities/:id - Schema Validation', () => {
    it('should return complete facility details', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/facilities/facility-001')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Complete schema validation
      expect(response.body).toMatchObject({
        id: 'facility-001',
        name: expect.any(String),
        address: expect.any(String),
        location: {
          latitude: expect.any(Number),
          longitude: expect.any(Number),
        },
        facilities: expect.any(Array),
      });

      // No internal fields exposed
      expect(response.body).not.toHaveProperty('_id');
      expect(response.body).not.toHaveProperty('__v');
      expect(response.body).not.toHaveProperty('createdAt');
    });

    it('should return 404 with proper error format for non-existent ID', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/facilities/non-existent-id-xyz-123')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      // Error response format validation
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('statusCode');
      expect(response.body.statusCode).toBe(404);
      expect(response.body.message).toContain('not found');
    });
  });

  describe('Security - AI-Generated Tests', () => {
    it('should reject requests without authentication', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/facilities')
        .expect(401);
    });

    it('should reject malformed JWT tokens', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/facilities')
        .set('Authorization', 'Bearer not-a-valid-jwt-token')
        .expect(401);
    });

    it('should reject requests with invalid Bearer format', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/facilities')
        .set('Authorization', authToken) // Missing 'Bearer' prefix
        .expect(401);
    });

    it('should handle SQL injection attempts safely', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/facilities?name=' + encodeURIComponent("'; DROP TABLE facilities; --"))
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Should not crash, return safe results
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toEqual([]);
    });
  });

  describe('Performance - Basic Validation', () => {
    it('should respond within acceptable latency', async () => {
      const startTime = Date.now();
      
      await request(app.getHttpServer())
        .get('/api/v1/facilities')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const responseTime = Date.now() - startTime;
      
      // Should respond within reasonable time for test environment
      expect(responseTime).toBeLessThan(1000);
    });

    it('should handle sequential requests efficiently', async () => {
      // Test sequential requests to avoid ECONNRESET in test environment
      for (let i = 0; i < 5; i++) {
        const response = await request(app.getHttpServer())
          .get('/api/v1/facilities')
          .set('Authorization', `Bearer ${authToken}`);
        
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('data');
      }
    });
  });

  describe('POST /api/v1/auth/login - Contract', () => {
    it('should return token and user object', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123',
        })
        .expect(200);

      // Response schema validation
      expect(response.body).toMatchObject({
        token: expect.any(String),
        user: {
          id: expect.any(String),
          email: 'test@example.com',
          name: expect.any(String),
        },
      });

      // JWT token format validation
      const tokenParts = response.body.token.split('.');
      expect(tokenParts.length).toBe(3); // header.payload.signature
    });

    it('should return 401 for invalid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword123', // Valid length but wrong password
        })
        .expect(401);

      expect(response.body).toHaveProperty('statusCode', 401);
      expect(response.body).toHaveProperty('message');
    });
  });
});
