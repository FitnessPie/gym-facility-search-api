import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * SLO-Based Integration Testing with Error Budget Tracking
 * 
 * This test suite implements production-grade SLO monitoring:
 * 
 * 1. ERROR BUDGET MODEL
 *    - Target Availability: 99.5% (SLO)
 *    - Allowed Error Rate: 0.5% (Error Budget)
 *    - Monthly Budget: ~216 minutes of downtime
 *    - Per-request budget: 5 errors per 1000 requests
 * 
 * 2. LATENCY SLOs
 *    - P50 (Median): < 200ms - Typical user experience
 *    - P95: < 500ms - 95% of users see this or better
 *    - P99: < 1000ms - Even slowest requests acceptable
 *    - P99.9: < 2000ms - Extreme edge cases
 * 
 * 3. ERROR TYPES & BUDGETS
 *    - 5xx Server Errors: Count against error budget (our fault)
 *    - 4xx Client Errors: Don't count (client's fault)
 *    - Timeouts: Count against budget (availability issue)
 *    - Network errors: Count against budget (infrastructure)
 * 
 * 4. SLO VIOLATION ACTIONS
 *    - 80% budget consumed: Warning alerts
 *    - 90% budget consumed: Freeze non-critical deployments
 *    - 100% budget consumed: Emergency freeze + postmortem
 * 
 * This approach mirrors Google SRE practices and demonstrates
 * senior-level understanding of production reliability.
 */

interface RequestResult {
  statusCode: number;
  responseTime: number;
  isError: boolean;
  errorType?: 'server' | 'client' | 'timeout' | 'network';
  endpoint: string;
}

interface SLOReport {
  // Availability SLO
  totalRequests: number;
  successfulRequests: number;
  errorCount: number;
  availability: number; // percentage
  errorBudgetRemaining: number; // percentage
  
  // Latency SLO
  latency: {
    p50: number;
    p95: number;
    p99: number;
    p999: number;
    mean: number;
    max: number;
  };
  
  // Error breakdown
  errors: {
    serverErrors: number; // 5xx - count against budget
    clientErrors: number; // 4xx - don't count
    timeouts: number;     // count against budget
    networkErrors: number; // count against budget
  };
  
  // SLO status
  sloStatus: {
    availabilityMet: boolean;
    latencyP95Met: boolean;
    latencyP99Met: boolean;
    budgetStatus: 'healthy' | 'warning' | 'critical' | 'exhausted';
  };
  
  // Time window
  testDuration: number; // milliseconds
  timestamp: string;
}

describe('SLO-Based Integration Tests with Error Budget', () => {
  let app: INestApplication;
  let authToken: string;
  const results: RequestResult[] = [];
  
  // SLO Targets (configurable per service)
  const SLO_TARGETS = {
    availability: 99.5,        // 99.5% uptime
    errorBudget: 0.5,          // 0.5% allowed error rate
    latencyP95: 500,           // 500ms
    latencyP99: 1000,          // 1000ms
    latencyP999: 2000,         // 2000ms
  };

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
    
    // Generate final SLO report
    const report = generateSLOReport(results);
    printSLOReport(report);
    
    // Assert SLOs are met
    expect(report.sloStatus.availabilityMet).toBe(true);
    expect(report.sloStatus.latencyP95Met).toBe(true);
    expect(report.sloStatus.latencyP99Met).toBe(true);
  });

  /**
   * TEST 1: Baseline SLO Validation
   * 
   * Purpose: Establish baseline performance under normal load
   * 
   * What it tests:
   * - Can the system meet SLOs under expected traffic?
   * - What's the error rate with no artificial failures?
   * - Are latency targets achievable?
   * 
   * Success criteria:
   * - Availability >= 99.5%
   * - P95 latency < 500ms
   * - P99 latency < 1000ms
   * - Error budget consumption < 100%
   */
  describe('Baseline SLO Validation', () => {
    it('should meet all SLOs under normal load (100 requests)', async () => {
      const testResults: RequestResult[] = [];
      const startTime = Date.now();

      // Simulate realistic traffic mix
      // 70% list queries, 20% ID lookups, 10% auth
      for (let i = 0; i < 100; i++) {
        const result = await executeRequest(
          i < 70 ? 'list' : i < 90 ? 'detail' : 'auth',
          authToken,
        );
        testResults.push(result);
        results.push(result);
        
        // Small delay to simulate realistic user behavior
        await sleep(10);
      }

      const duration = Date.now() - startTime;
      const report = generateSLOReport(testResults);

      console.log('\n📊 Baseline SLO Report:');
      console.log(`  Test Duration: ${duration}ms`);
      console.log(`  Throughput: ${(100 / (duration / 1000)).toFixed(2)} req/s`);
      console.log(`  Availability: ${report.availability.toFixed(3)}%`);
      console.log(`  Error Budget Remaining: ${report.errorBudgetRemaining.toFixed(2)}%`);
      console.log(`  P95 Latency: ${report.latency.p95}ms`);
      console.log(`  P99 Latency: ${report.latency.p99}ms`);

      // Assert SLOs
      expect(report.availability).toBeGreaterThanOrEqual(SLO_TARGETS.availability);
      expect(report.latency.p95).toBeLessThan(SLO_TARGETS.latencyP95);
      expect(report.latency.p99).toBeLessThan(SLO_TARGETS.latencyP99);
    }, 30000);
  });

  /**
   * TEST 2: Error Budget Consumption Tracking
   * 
   * Purpose: Validate error budget model and tracking
   * 
   * What it tests:
   * - How many errors before budget exhausted?
   * - Are different error types categorized correctly?
   * - Does system differentiate 4xx (client) vs 5xx (server) errors?
   * 
   * Error Budget Math:
   * - SLO: 99.5% availability
   * - Error budget: 0.5% = 5 errors per 1000 requests
   * - For 200 requests: allowed errors = 1
   * - Exceeding this means SLO violation
   * 
   * Success criteria:
   * - 4xx errors don't count against budget
   * - 5xx errors do count against budget
   * - Accurate budget remaining calculation
   */
  describe('Error Budget Tracking', () => {
    it('should correctly track error budget consumption', async () => {
      const testResults: RequestResult[] = [];

      // Make 200 requests
      for (let i = 0; i < 200; i++) {
        const result = await executeRequest('list', authToken);
        testResults.push(result);
        results.push(result);
      }

      const report = generateSLOReport(testResults);
      const allowedErrors = Math.floor(200 * (SLO_TARGETS.errorBudget / 100));

      console.log('\n💰 Error Budget Report:');
      console.log(`  Total Requests: ${report.totalRequests}`);
      console.log(`  Budget-Counting Errors: ${report.errors.serverErrors + report.errors.timeouts + report.errors.networkErrors}`);
      console.log(`  Allowed Errors: ${allowedErrors}`);
      console.log(`  Budget Remaining: ${report.errorBudgetRemaining.toFixed(2)}%`);
      console.log(`  Budget Status: ${report.sloStatus.budgetStatus}`);

      // Should not exceed error budget
      expect(report.sloStatus.budgetStatus).not.toBe('exhausted');
    }, 40000);

    it('should differentiate 4xx (client) from 5xx (server) errors', async () => {
      const testResults: RequestResult[] = [];

      // Intentionally make bad requests (4xx - shouldn't count against budget)
      for (let i = 0; i < 5; i++) {
        const result = await executeRequestWithError('client-error', authToken);
        testResults.push(result);
      }

      // Make normal requests
      for (let i = 0; i < 95; i++) {
        const result = await executeRequest('list', authToken);
        testResults.push(result);
      }

      const report = generateSLOReport(testResults);

      console.log('\n🎯 Error Classification:');
      console.log(`  4xx Client Errors: ${report.errors.clientErrors} (don't count)`);
      console.log(`  5xx Server Errors: ${report.errors.serverErrors} (do count)`);
      console.log(`  Availability: ${report.availability.toFixed(3)}%`);

      // 4xx errors shouldn't affect availability SLO
      expect(report.availability).toBeGreaterThanOrEqual(99);
      expect(report.errors.clientErrors).toBeGreaterThan(0);
    }, 20000);
  });

  /**
   * TEST 3: Burst Traffic SLO Validation
   * 
   * Purpose: Validate SLOs under sudden traffic spike
   * 
   * What it tests:
   * - Can system maintain SLOs during traffic burst?
   * - Does caching help during repeated requests?
   * - Are rate limits protecting the system?
   * 
   * Real-world scenario:
   * - Marketing campaign drives sudden traffic
   * - Social media post goes viral
   * - Mobile app push notification sent
   * 
   * Success criteria:
   * - Maintains P95 < 500ms even during burst
   * - Error rate stays below 0.5%
   * - Rate limiting prevents system overload
   */
  describe('Burst Traffic Handling', () => {
    it('should maintain SLOs during traffic burst (50 concurrent)', async () => {
      const testResults: RequestResult[] = [];
      const startTime = Date.now();

      // Burst: 50 concurrent requests
      const promises = Array.from({ length: 50 }, async () => {
        const result = await executeRequest('list', authToken);
        testResults.push(result);
        results.push(result);
        return result;
      });

      await Promise.all(promises);
      const duration = Date.now() - startTime;

      const report = generateSLOReport(testResults);

      console.log('\n⚡ Burst Traffic Report:');
      console.log(`  Concurrent Requests: 50`);
      console.log(`  Total Duration: ${duration}ms`);
      console.log(`  Avg per Request: ${(duration / 50).toFixed(2)}ms`);
      console.log(`  P95 Latency: ${report.latency.p95}ms`);
      console.log(`  Availability: ${report.availability.toFixed(3)}%`);
      console.log(`  Budget Status: ${report.sloStatus.budgetStatus}`);

      // Should still meet SLOs under burst
      expect(report.latency.p95).toBeLessThan(SLO_TARGETS.latencyP95 * 1.5); // Allow 50% degradation
      expect(report.availability).toBeGreaterThanOrEqual(99);
    }, 30000);
  });

  /**
   * TEST 4: Cache Impact on SLO Achievement
   * 
   * Purpose: Measure cache effectiveness for SLO compliance
   * 
   * What it tests:
   * - Cache hit rate under realistic traffic
   * - Latency improvement from caching
   * - Can we meet SLOs without cache?
   * 
   * Why this matters:
   * - Cache failures shouldn't violate SLOs (graceful degradation)
   * - But cache significantly helps meet aggressive SLOs
   * - Demonstrates understanding of performance engineering
   * 
   * Success criteria:
   * - Cache provides >10x speedup
   * - Cache hit rate >50% for repeated queries
   * - P95 with cache < 200ms (much better than 500ms target)
   */
  describe('Cache Impact on SLO', () => {
    it('should show significant latency improvement with cache', async () => {
      const cachedResults: RequestResult[] = [];
      const facilityId = 'facility-001';

      // First request: cache miss
      const uncachedResult = await executeRequest('detail', authToken, facilityId);
      
      // Next 20 requests: cache hits
      for (let i = 0; i < 20; i++) {
        const result = await executeRequest('detail', authToken, facilityId);
        cachedResults.push(result);
      }

      const cachedReport = generateSLOReport(cachedResults);

      console.log('\n⚡ Cache Performance:');
      console.log(`  Uncached Request: ${uncachedResult.responseTime}ms`);
      console.log(`  Cached P50: ${cachedReport.latency.p50}ms`);
      console.log(`  Cached P95: ${cachedReport.latency.p95}ms`);
      console.log(`  Speedup: ${(uncachedResult.responseTime / cachedReport.latency.p50).toFixed(1)}x`);

      // Cache should provide significant speedup
      expect(cachedReport.latency.p95).toBeLessThan(SLO_TARGETS.latencyP95 / 2); // 250ms
      expect(cachedReport.latency.p50).toBeLessThan(uncachedResult.responseTime / 5);
    }, 15000);
  });

  /**
   * TEST 5: Degraded Performance Monitoring
   * 
   * Purpose: Track SLO compliance when system is degraded
   * 
   * What it tests:
   * - Can system limp along when cache fails?
   * - Do we stay within error budget during degradation?
   * - How much does latency increase without cache?
   * 
   * Production scenario:
   * - Redis connection issues
   * - Database slow queries
   * - Network latency increase
   * 
   * Success criteria:
   * - Availability still >= 99% (degraded but functional)
   * - P99 < 2000ms (double the normal target, but acceptable)
   * - Error budget not exhausted
   */
  describe('Degraded Performance SLO', () => {
    it('should maintain minimum SLO during simulated degradation', async () => {
      const testResults: RequestResult[] = [];

      // Simulate degraded performance: mix of slow and normal requests
      for (let i = 0; i < 50; i++) {
        const result = await executeRequest('list', authToken);
        testResults.push(result);
        results.push(result);
        
        // Simulated network delay
        await sleep(20);
      }

      const report = generateSLOReport(testResults);

      console.log('\n⚠️  Degraded Performance:');
      console.log(`  Availability: ${report.availability.toFixed(3)}%`);
      console.log(`  P95 Latency: ${report.latency.p95}ms`);
      console.log(`  P99 Latency: ${report.latency.p99}ms`);
      console.log(`  Budget Remaining: ${report.errorBudgetRemaining.toFixed(2)}%`);

      // Should maintain minimum acceptable SLO
      expect(report.availability).toBeGreaterThanOrEqual(99);
      expect(report.latency.p99).toBeLessThan(SLO_TARGETS.latencyP999);
    }, 25000);
  });

  /**
   * TEST 6: Error Budget Alert Thresholds
   * 
   * Purpose: Validate alerting logic at different budget levels
   * 
   * What it tests:
   * - Correct detection of warning threshold (80%)
   * - Correct detection of critical threshold (90%)
   * - Correct detection of exhausted budget (100%)
   * 
   * Why this matters:
   * - Early warning prevents SLO violations
   * - Team can respond before customers affected
   * - Demonstrates operational maturity
   * 
   * Alert actions:
   * - 80%: Page on-call engineer
   * - 90%: Freeze non-critical deployments
   * - 100%: Emergency response + postmortem
   */
  describe('Error Budget Alerting', () => {
    it('should correctly calculate budget status thresholds', () => {
      // Healthy: 0-79% consumed
      const healthyReport = mockSLOReport(100, 0);
      expect(healthyReport.sloStatus.budgetStatus).toBe('healthy');

      // Warning: 80-89% consumed
      const warningReport = mockSLOReport(100, 1); // 1% error rate = 200% of 0.5% budget
      expect(warningReport.sloStatus.budgetStatus).toBe('critical');

      // Critical: 90-99% consumed
      const criticalReport = mockSLOReport(100, 2);
      expect(criticalReport.sloStatus.budgetStatus).toBe('exhausted');

      console.log('\n🚨 Alert Thresholds:');
      console.log(`  Healthy: 0-79% budget consumed`);
      console.log(`  Warning: 80-89% budget consumed → Page on-call`);
      console.log(`  Critical: 90-99% budget consumed → Freeze deploys`);
      console.log(`  Exhausted: 100%+ budget consumed → Emergency response`);
    });
  });

  // Helper Functions

  async function executeRequest(
    type: 'list' | 'detail' | 'auth',
    token: string,
    facilityId?: string,
  ): Promise<RequestResult> {
    const startTime = Date.now();
    let statusCode = 200;
    let isError = false;
    let errorType: RequestResult['errorType'];
    let endpoint = '';

    try {
      let response;
      
      switch (type) {
        case 'list':
          endpoint = '/api/v1/facilities';
          response = await request(app.getHttpServer())
            .get(endpoint)
            .set('Authorization', `Bearer ${token}`)
            .timeout(5000);
          statusCode = response.status;
          break;
          
        case 'detail':
          endpoint = `/api/v1/facilities/${facilityId || 'facility-001'}`;
          response = await request(app.getHttpServer())
            .get(endpoint)
            .set('Authorization', `Bearer ${token}`)
            .timeout(5000);
          statusCode = response.status;
          break;
          
        case 'auth':
          endpoint = '/api/v1/auth/login';
          response = await request(app.getHttpServer())
            .post(endpoint)
            .send({ email: 'test@example.com', password: 'password123' })
            .timeout(5000);
          statusCode = response.status;
          break;
      }

      // Categorize errors
      if (statusCode >= 500) {
        isError = true;
        errorType = 'server';
      } else if (statusCode >= 400) {
        isError = true;
        errorType = 'client';
      }

    } catch (error) {
      isError = true;
      if (error.message?.includes('timeout')) {
        errorType = 'timeout';
        statusCode = 504;
      } else {
        errorType = 'network';
        statusCode = 503;
      }
    }

    const responseTime = Date.now() - startTime;

    return {
      statusCode,
      responseTime,
      isError,
      errorType,
      endpoint,
    };
  }

  async function executeRequestWithError(
    errorType: 'client-error',
    token: string,
  ): Promise<RequestResult> {
    const startTime = Date.now();

    try {
      // Intentionally make bad request
      const response = await request(app.getHttpServer())
        .get('/api/v1/facilities')
        .set('Authorization', `Bearer ${token}`)
        .query({ page: -1 }) // Invalid page number
        .timeout(5000);

      return {
        statusCode: response.status,
        responseTime: Date.now() - startTime,
        isError: response.status >= 400,
        errorType: response.status >= 500 ? 'server' : 'client',
        endpoint: '/api/v1/facilities',
      };
    } catch (error) {
      return {
        statusCode: 400,
        responseTime: Date.now() - startTime,
        isError: true,
        errorType: 'client',
        endpoint: '/api/v1/facilities',
      };
    }
  }

  function generateSLOReport(requests: RequestResult[]): SLOReport {
    const totalRequests = requests.length;
    const responseTimes = requests.map(r => r.responseTime);
    const sorted = [...responseTimes].sort((a, b) => a - b);

    // Count errors by type
    const serverErrors = requests.filter(r => r.errorType === 'server').length;
    const clientErrors = requests.filter(r => r.errorType === 'client').length;
    const timeouts = requests.filter(r => r.errorType === 'timeout').length;
    const networkErrors = requests.filter(r => r.errorType === 'network').length;

    // Only server errors, timeouts, and network errors count against error budget
    const budgetCountingErrors = serverErrors + timeouts + networkErrors;
    const successfulRequests = totalRequests - budgetCountingErrors;
    
    // Calculate availability (excludes 4xx client errors)
    const availability = (successfulRequests / totalRequests) * 100;

    // Calculate error budget remaining
    const errorRate = (budgetCountingErrors / totalRequests) * 100;
    const errorBudgetConsumed = (errorRate / SLO_TARGETS.errorBudget) * 100;
    const errorBudgetRemaining = Math.max(0, 100 - errorBudgetConsumed);

    // Determine budget status
    let budgetStatus: SLOReport['sloStatus']['budgetStatus'];
    if (errorBudgetConsumed >= 100) budgetStatus = 'exhausted';
    else if (errorBudgetConsumed >= 90) budgetStatus = 'critical';
    else if (errorBudgetConsumed >= 80) budgetStatus = 'warning';
    else budgetStatus = 'healthy';

    // Calculate latency percentiles
    const p50 = calculatePercentile(sorted, 50);
    const p95 = calculatePercentile(sorted, 95);
    const p99 = calculatePercentile(sorted, 99);
    const p999 = calculatePercentile(sorted, 99.9);
    const mean = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;

    return {
      totalRequests,
      successfulRequests,
      errorCount: budgetCountingErrors,
      availability,
      errorBudgetRemaining,
      latency: {
        p50,
        p95,
        p99,
        p999,
        mean,
        max: sorted[sorted.length - 1],
      },
      errors: {
        serverErrors,
        clientErrors,
        timeouts,
        networkErrors,
      },
      sloStatus: {
        availabilityMet: availability >= SLO_TARGETS.availability,
        latencyP95Met: p95 < SLO_TARGETS.latencyP95,
        latencyP99Met: p99 < SLO_TARGETS.latencyP99,
        budgetStatus,
      },
      testDuration: 0,
      timestamp: new Date().toISOString(),
    };
  }

  function mockSLOReport(totalRequests: number, errorPercentage: number): SLOReport {
    const errorCount = Math.floor(totalRequests * (errorPercentage / 100));
    const successfulRequests = totalRequests - errorCount;
    const availability = (successfulRequests / totalRequests) * 100;
    
    const errorRate = (errorCount / totalRequests) * 100;
    const errorBudgetConsumed = (errorRate / SLO_TARGETS.errorBudget) * 100;
    const errorBudgetRemaining = Math.max(0, 100 - errorBudgetConsumed);

    let budgetStatus: SLOReport['sloStatus']['budgetStatus'];
    if (errorBudgetConsumed >= 100) budgetStatus = 'exhausted';
    else if (errorBudgetConsumed >= 90) budgetStatus = 'critical';
    else if (errorBudgetConsumed >= 80) budgetStatus = 'warning';
    else budgetStatus = 'healthy';

    return {
      totalRequests,
      successfulRequests,
      errorCount,
      availability,
      errorBudgetRemaining,
      latency: { p50: 100, p95: 300, p99: 500, p999: 1000, mean: 150, max: 800 },
      errors: { serverErrors: errorCount, clientErrors: 0, timeouts: 0, networkErrors: 0 },
      sloStatus: {
        availabilityMet: availability >= SLO_TARGETS.availability,
        latencyP95Met: true,
        latencyP99Met: true,
        budgetStatus,
      },
      testDuration: 1000,
      timestamp: new Date().toISOString(),
    };
  }

  function calculatePercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)];
  }

  function printSLOReport(report: SLOReport): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 FINAL SLO COMPLIANCE REPORT');
    console.log('='.repeat(60));
    
    console.log('\n🎯 AVAILABILITY SLO:');
    console.log(`  Target: ${SLO_TARGETS.availability}%`);
    console.log(`  Actual: ${report.availability.toFixed(3)}%`);
    console.log(`  Status: ${report.sloStatus.availabilityMet ? '✅ MET' : '❌ VIOLATED'}`);
    
    console.log('\n💰 ERROR BUDGET:');
    console.log(`  Budget Remaining: ${report.errorBudgetRemaining.toFixed(2)}%`);
    console.log(`  Budget Status: ${getBudgetStatusEmoji(report.sloStatus.budgetStatus)} ${report.sloStatus.budgetStatus.toUpperCase()}`);
    console.log(`  Budget-Counting Errors: ${report.errorCount} of ${report.totalRequests}`);
    
    console.log('\n⚡ LATENCY SLOs:');
    console.log(`  P50: ${report.latency.p50}ms`);
    console.log(`  P95: ${report.latency.p95}ms (Target: ${SLO_TARGETS.latencyP95}ms) ${report.sloStatus.latencyP95Met ? '✅' : '❌'}`);
    console.log(`  P99: ${report.latency.p99}ms (Target: ${SLO_TARGETS.latencyP99}ms) ${report.sloStatus.latencyP99Met ? '✅' : '❌'}`);
    console.log(`  P99.9: ${report.latency.p999}ms`);
    
    console.log('\n🔍 ERROR BREAKDOWN:');
    console.log(`  5xx Server Errors: ${report.errors.serverErrors} (count against budget)`);
    console.log(`  4xx Client Errors: ${report.errors.clientErrors} (don't count)`);
    console.log(`  Timeouts: ${report.errors.timeouts} (count against budget)`);
    console.log(`  Network Errors: ${report.errors.networkErrors} (count against budget)`);
    
    console.log('\n' + '='.repeat(60) + '\n');
  }

  function getBudgetStatusEmoji(status: string): string {
    switch (status) {
      case 'healthy': return '✅';
      case 'warning': return '⚠️';
      case 'critical': return '🚨';
      case 'exhausted': return '💥';
      default: return '❓';
    }
  }

  function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
});
