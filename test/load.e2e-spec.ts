import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * Load Tests - SLO-Aligned Performance Testing
 * 
 * SLO Targets:
 * - Error Rate: < 0.5% (99.5% success rate)
 * - P95 Latency: < 500ms
 * - P99 Latency: < 1000ms
 * - Throughput: >= 100 requests/second
 */
describe('Load Tests - SLO Compliance (AI-First)', () => {
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

  /**
   * Calculate percentile from sorted array
   */
  function calculatePercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)];
  }

  /**
   * Calculate statistics from response times
   */
  function calculateStats(responseTimes: number[]) {
    const sorted = [...responseTimes].sort((a, b) => a - b);
    const sum = sorted.reduce((acc, val) => acc + val, 0);
    
    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean: sum / sorted.length,
      p50: calculatePercentile(sorted, 50),
      p95: calculatePercentile(sorted, 95),
      p99: calculatePercentile(sorted, 99),
      count: sorted.length,
    };
  }

  describe('GET /api/v1/facilities - Load Testing', () => {
    it('should handle 50 concurrent requests within SLO', async () => {
      const concurrentRequests = 50;
      const responseTimes: number[] = [];
      const errors: number[] = [];

      const requests = Array.from({ length: concurrentRequests }, async (_, i) => {
        const startTime = Date.now();
        
        try {
          const response = await request(app.getHttpServer())
            .get('/api/v1/facilities?page=1&limit=10')
            .set('Authorization', `Bearer ${authToken}`);

          const responseTime = Date.now() - startTime;
          responseTimes.push(responseTime);

          if (response.status !== 200) {
            errors.push(i);
          }

          return response;
        } catch (error) {
          errors.push(i);
          throw error;
        }
      });

      // Execute all requests
      const startTime = Date.now();
      await Promise.all(requests);
      const totalTime = Date.now() - startTime;

      // Calculate statistics
      const stats = calculateStats(responseTimes);
      const errorRate = (errors.length / concurrentRequests) * 100;
      const throughput = (concurrentRequests / totalTime) * 1000; // requests/second

      // Log performance metrics
      console.log('\n📊 Load Test Results:');
      console.log(`   Total Requests: ${concurrentRequests}`);
      console.log(`   Total Time: ${totalTime}ms`);
      console.log(`   Throughput: ${throughput.toFixed(2)} req/s`);
      console.log(`   Error Rate: ${errorRate.toFixed(2)}%`);
      console.log(`   Response Times:`);
      console.log(`     Min: ${stats.min}ms`);
      console.log(`     Mean: ${stats.mean.toFixed(2)}ms`);
      console.log(`     P50: ${stats.p50}ms`);
      console.log(`     P95: ${stats.p95}ms`);
      console.log(`     P99: ${stats.p99}ms`);
      console.log(`     Max: ${stats.max}ms`);

      // SLO Assertions
      expect(errorRate).toBeLessThan(0.5); // < 0.5% error rate
      expect(stats.p95).toBeLessThan(500); // P95 < 500ms
      expect(stats.p99).toBeLessThan(1000); // P99 < 1000ms
      expect(errors.length).toBe(0); // No errors in test environment
    }, 30000); // 30s timeout for load test

    it('should maintain performance with search filters', async () => {
      const concurrentRequests = 50;
      const responseTimes: number[] = [];

      const searchQueries = [
        'gym',
        'pool',
        'yoga',
        'fitness',
        'sports',
      ];

      const requests = Array.from({ length: concurrentRequests }, (_, i) => {
        const query = searchQueries[i % searchQueries.length];
        const startTime = Date.now();
        
        return request(app.getHttpServer())
          .get(`/api/v1/facilities?name=${query}`)
          .set('Authorization', `Bearer ${authToken}`)
          .then(response => {
            const responseTime = Date.now() - startTime;
            responseTimes.push(responseTime);
            return response;
          });
      });

      await Promise.all(requests);

      const stats = calculateStats(responseTimes);

      console.log('\n🔍 Search Filter Load Test:');
      console.log(`   P50: ${stats.p50}ms`);
      console.log(`   P95: ${stats.p95}ms`);
      console.log(`   P99: ${stats.p99}ms`);

      // Should still meet SLO with filters
      expect(stats.p95).toBeLessThan(500);
      expect(stats.p99).toBeLessThan(1000);
    }, 20000);

    it('should handle pagination load efficiently', async () => {
      const pages = 20;
      const responseTimes: number[] = [];

      const requests = Array.from({ length: pages }, (_, page) => {
        const startTime = Date.now();
        
        return request(app.getHttpServer())
          .get(`/api/v1/facilities?page=${page + 1}&limit=10`)
          .set('Authorization', `Bearer ${authToken}`)
          .then(response => {
            const responseTime = Date.now() - startTime;
            responseTimes.push(responseTime);
            return response;
          });
      });

      await Promise.all(requests);

      const stats = calculateStats(responseTimes);

      console.log('\n📄 Pagination Load Test:');
      console.log(`   Mean: ${stats.mean.toFixed(2)}ms`);
      console.log(`   P95: ${stats.p95}ms`);

      // Pagination should be fast (cached)
      expect(stats.p95).toBeLessThan(500);
    }, 15000);
  });

  describe('GET /api/v1/facilities/:id - Load Testing', () => {
    it('should handle ID lookups at scale', async () => {
      const concurrentRequests = 50;
      const responseTimes: number[] = [];
      
      // Test with known ID (should hit cache)
      const facilityId = 'facility-001';

      const requests = Array.from({ length: concurrentRequests }, () => {
        const startTime = Date.now();
        
        return request(app.getHttpServer())
          .get(`/api/v1/facilities/${facilityId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .then(response => {
            const responseTime = Date.now() - startTime;
            responseTimes.push(responseTime);
            expect(response.status).toBe(200);
            return response;
          });
      });

      await Promise.all(requests);

      const stats = calculateStats(responseTimes);

      console.log('\n🎯 ID Lookup Load Test:');
      console.log(`   Requests: ${concurrentRequests}`);
      console.log(`   Mean: ${stats.mean.toFixed(2)}ms`);
      console.log(`   P50: ${stats.p50}ms`);
      console.log(`   P95: ${stats.p95}ms`);
      console.log(`   P99: ${stats.p99}ms`);

      // Cached lookups should be very fast
      expect(stats.p95).toBeLessThan(200); // Stricter for cached responses
      expect(stats.p99).toBeLessThan(500);
    }, 20000);
  });

  describe('POST /api/v1/auth/login - Load Testing', () => {
    it('should handle authentication load', async () => {
      const concurrentLogins = 50;
      const responseTimes: number[] = [];
      const errors: number[] = [];

      const requests = Array.from({ length: concurrentLogins }, async (_, i) => {
        const startTime = Date.now();
        
        try {
          const response = await request(app.getHttpServer())
            .post('/api/v1/auth/login')
            .send({
              email: 'test@example.com',
              password: 'password123',
            });

          const responseTime = Date.now() - startTime;
          responseTimes.push(responseTime);

          if (response.status !== 200) {
            errors.push(i);
          }

          return response;
        } catch (error) {
          errors.push(i);
          throw error;
        }
      });

      await Promise.all(requests);

      const stats = calculateStats(responseTimes);
      const errorRate = (errors.length / concurrentLogins) * 100;

      console.log('\n🔐 Authentication Load Test:');
      console.log(`   Requests: ${concurrentLogins}`);
      console.log(`   Error Rate: ${errorRate.toFixed(2)}%`);
      console.log(`   P50: ${stats.p50}ms`);
      console.log(`   P95: ${stats.p95}ms`);
      console.log(`   P99: ${stats.p99}ms`);

      // Authentication should meet SLO
      expect(errorRate).toBeLessThan(0.5);
      expect(stats.p95).toBeLessThan(500);
      expect(stats.p99).toBeLessThan(1000);
    }, 20000);
  });

  describe('Mixed Workload - Realistic Traffic Pattern', () => {
    it('should handle mixed read/write operations', async () => {
      const totalRequests = 50;
      const responseTimes: number[] = [];
      const errors: Error[] = [];

      // Realistic traffic mix:
      // 70% list queries, 20% ID lookups, 10% auth
      const requests = Array.from({ length: totalRequests }, (_, i) => {
        const startTime = Date.now();
        const rand = Math.random();

        let requestPromise: Promise<any>;

        if (rand < 0.7) {
          // 70% - List queries
          requestPromise = request(app.getHttpServer())
            .get('/api/v1/facilities?page=1&limit=10')
            .set('Authorization', `Bearer ${authToken}`);
        } else if (rand < 0.9) {
          // 20% - ID lookups
          requestPromise = request(app.getHttpServer())
            .get('/api/v1/facilities/facility-001')
            .set('Authorization', `Bearer ${authToken}`);
        } else {
          // 10% - Authentication
          requestPromise = request(app.getHttpServer())
            .post('/api/v1/auth/login')
            .send({
              email: 'test@example.com',
              password: 'password123',
            });
        }

        return requestPromise
          .then(response => {
            const responseTime = Date.now() - startTime;
            responseTimes.push(responseTime);
            return response;
          })
          .catch(error => {
            errors.push(error);
            throw error;
          });
      });

      const startTime = Date.now();
      await Promise.all(requests);
      const totalTime = Date.now() - startTime;

      const stats = calculateStats(responseTimes);
      const errorRate = (errors.length / totalRequests) * 100;
      const throughput = (totalRequests / totalTime) * 1000;

      console.log('\n🔀 Mixed Workload Test:');
      console.log(`   Total Requests: ${totalRequests}`);
      console.log(`   Total Time: ${totalTime}ms`);
      console.log(`   Throughput: ${throughput.toFixed(2)} req/s`);
      console.log(`   Error Rate: ${errorRate.toFixed(2)}%`);
      console.log(`   P50: ${stats.p50}ms`);
      console.log(`   P95: ${stats.p95}ms`);
      console.log(`   P99: ${stats.p99}ms`);

      // Mixed workload should still meet SLO
      expect(errorRate).toBeLessThan(0.5);
      expect(stats.p95).toBeLessThan(500);
      expect(stats.p99).toBeLessThan(1000);
    }, 30000);
  });

  describe('Cache Performance - Redis Impact', () => {
    it('should show significant cache speedup', async () => {
      const facilityId = 'facility-001';

      // First request (cache miss)
      const uncachedStart = Date.now();
      await request(app.getHttpServer())
        .get(`/api/v1/facilities/${facilityId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      const uncachedTime = Date.now() - uncachedStart;

      // Subsequent requests (cache hit)
      const cachedTimes: number[] = [];
      for (let i = 0; i < 10; i++) {
        const cachedStart = Date.now();
        await request(app.getHttpServer())
          .get(`/api/v1/facilities/${facilityId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);
        cachedTimes.push(Date.now() - cachedStart);
      }

      const avgCachedTime = cachedTimes.reduce((a, b) => a + b, 0) / cachedTimes.length;

      console.log('\n⚡ Cache Performance:');
      console.log(`   Uncached: ${uncachedTime}ms`);
      console.log(`   Avg Cached: ${avgCachedTime.toFixed(2)}ms`);
      console.log(`   Speedup: ${(uncachedTime / avgCachedTime).toFixed(2)}x`);

      // Cached should be significantly faster
      expect(avgCachedTime).toBeLessThan(uncachedTime);
    }, 15000);
  });
});
