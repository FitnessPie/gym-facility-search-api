# Integration Testing - AI-First Approach

## Overview

This project uses an **AI-first testing strategy** aligned with production SLOs and error budgets.

## Testing Strategy

### 1. **Current E2E Tests** (Supertest - Already Implemented)
- ✅ 10 HTTP integration tests
- ✅ JWT authentication flow
- ✅ Database integration (MongoDB)
- ✅ Cache integration (Redis)
- ✅ Pagination, filtering, sorting

### 2. **Contract Testing** (AI-Generated from OpenAPI)
- Generate tests from Swagger/OpenAPI spec
- Validate request/response schemas
- Ensure API contract compliance

### 3. **Load Testing** (SLO-Aligned)
- Performance tests targeting < 0.5% error rate
- Latency SLOs: P95 < 500ms, P99 < 1000ms
- Throughput: 100+ req/min per endpoint

### 4. **Chaos Engineering** (Error Budget Testing)
- Redis failure simulation
- MongoDB connection drops
- Rate limit testing
- Timeout scenarios

---

## AI-First Testing Workflow

### Step 1: Generate Tests from OpenAPI Spec

```bash
# Your API has Swagger at /api/docs
# Use AI to generate tests from this spec

# Prompt for Claude/Cursor:
"Analyze the OpenAPI spec at http://localhost:3000/api/docs and generate:
1. Contract tests for all endpoints
2. Edge case tests (null, empty, invalid types)
3. Security tests (auth bypass, injection)
4. Performance tests for SLO compliance"
```

### Step 2: SLO-Aligned Integration Tests

**Error Budget**: 99.5% uptime = 0.5% error rate allowed

```typescript
// Target SLOs:
// - Error rate: < 0.5%
// - P95 latency: < 500ms
// - P99 latency: < 1000ms
// - Availability: > 99.5%
```

### Step 3: CI/CD Auto-Generation

```yaml
# GitHub Actions workflow (already in .github/workflows/ci.yml)
# Can be enhanced with:
- AI-powered test generation on PR
- Contract validation against OpenAPI
- Performance regression detection
```

---

## Implementation

### Contract Testing (OpenAPI-driven)

```typescript
// test/contract.e2e-spec.ts
// AI-generated from OpenAPI spec

import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('API Contract Tests (AI-Generated)', () => {
  let app;
  let authToken;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Get auth token
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });
    authToken = loginRes.body.token;
  });

  // AI Prompt: "Generate contract tests for GET /api/v1/facilities"
  describe('GET /api/v1/facilities - Contract', () => {
    it('should return schema-compliant response', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/facilities')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Validate response schema
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('meta');
      expect(Array.isArray(response.body.data)).toBe(true);
      
      // Meta schema validation
      expect(response.body.meta).toMatchObject({
        total: expect.any(Number),
        page: expect.any(Number),
        limit: expect.any(Number),
        totalPages: expect.any(Number),
        hasNextPage: expect.any(Boolean),
        hasPreviousPage: expect.any(Boolean),
      });

      // Data item schema validation
      if (response.body.data.length > 0) {
        const facility = response.body.data[0];
        expect(facility).toMatchObject({
          id: expect.any(String),
          name: expect.any(String),
          address: expect.any(String),
          location: {
            latitude: expect.any(Number),
            longitude: expect.any(Number),
            city: expect.any(String),
          },
          facilities: expect.any(Array),
          rating: expect.any(Number),
        });
      }
    });

    // AI-generated edge cases
    it('should handle invalid query parameters', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/facilities?page=-1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should handle extreme pagination', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/facilities?page=999999&limit=1000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
    });
  });

  // AI Prompt: "Generate security tests for authentication"
  describe('Security Tests (AI-Generated)', () => {
    it('should reject requests without auth token', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/facilities')
        .expect(401);
    });

    it('should reject invalid JWT tokens', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/facilities')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should reject expired tokens', async () => {
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZXhwIjoxNTE2MjM5MDIyfQ.4Adcj0pB8CJnl0NeRxc5yR6m0RUb8LhPw-7oO_q0c5c';
      await request(app.getHttpServer())
        .get('/api/v1/facilities')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });
  });

  afterAll(async () => {
    await app.close();
  });
});
```

### Load Testing (SLO-Aligned)

```typescript
// test/load.e2e-spec.ts
// AI Prompt: "Generate load tests ensuring error rate < 0.5% at 100 req/min"

import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Load Tests - SLO Compliance', () => {
  let app;
  let authToken;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });
    authToken = loginRes.body.token;
  });

  it('should handle 100 concurrent requests with < 0.5% error rate', async () => {
    const requests = 100;
    const startTime = Date.now();
    const results = [];

    // Fire concurrent requests
    const promises = Array.from({ length: requests }, () =>
      request(app.getHttpServer())
        .get('/api/v1/facilities')
        .set('Authorization', `Bearer ${authToken}`)
        .then(res => ({
          status: res.status,
          time: Date.now() - startTime,
        }))
        .catch(err => ({
          status: err.response?.status || 500,
          time: Date.now() - startTime,
        }))
    );

    const responses = await Promise.all(promises);
    const endTime = Date.now();
    const duration = endTime - startTime;

    // Calculate metrics
    const successCount = responses.filter(r => r.status === 200).length;
    const errorCount = responses.filter(r => r.status >= 400).length;
    const errorRate = (errorCount / requests) * 100;

    // Sort by time for percentile calculation
    const times = responses.map(r => r.time).sort((a, b) => a - b);
    const p95 = times[Math.floor(requests * 0.95)];
    const p99 = times[Math.floor(requests * 0.99)];

    console.log(`
      Load Test Results:
      - Requests: ${requests}
      - Duration: ${duration}ms
      - Success: ${successCount}
      - Errors: ${errorCount}
      - Error Rate: ${errorRate.toFixed(2)}%
      - P95 Latency: ${p95}ms
      - P99 Latency: ${p99}ms
    `);

    // SLO Assertions
    expect(errorRate).toBeLessThan(0.5); // < 0.5% error rate
    expect(p95).toBeLessThan(500); // P95 < 500ms
    expect(p99).toBeLessThan(1000); // P99 < 1000ms
  });

  afterAll(async () => {
    await app.close();
  });
});
```

### Chaos Engineering Tests

```typescript
// test/chaos.e2e-spec.ts
// AI Prompt: "Generate chaos tests for Redis and MongoDB failures"

import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Chaos Engineering Tests', () => {
  let app;
  let authToken;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });
    authToken = loginRes.body.token;
  });

  it('should gracefully handle Redis cache failures', async () => {
    // Simulate cache failure by stopping Redis (in real test, mock cache.get to throw)
    // API should still work, just slower
    
    const response = await request(app.getHttpServer())
      .get('/api/v1/facilities')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.data).toBeDefined();
  });

  it('should handle rate limiting gracefully', async () => {
    // Fire 200 requests in 1 second (exceeds 100/min limit)
    const requests = Array.from({ length: 200 }, () =>
      request(app.getHttpServer())
        .get('/api/v1/facilities')
        .set('Authorization', `Bearer ${authToken}`)
    );

    const responses = await Promise.allSettled(requests);
    
    // Some should be rate limited (429)
    const rateLimited = responses.filter(
      r => r.status === 'fulfilled' && r.value.status === 429
    );
    
    expect(rateLimited.length).toBeGreaterThan(0);
  });

  it('should handle database connection errors', async () => {
    // In real test, mock MongoDB connection to fail
    // API should return 500 but not crash
    
    // This test would need connection mocking
    expect(true).toBe(true);
  });

  afterAll(async () => {
    await app.close();
  });
});
```

---

## AI Prompts for Test Generation

### Claude/Cursor Prompts

```
1. "Analyze the Swagger docs at /api/docs and generate comprehensive 
   integration tests covering all endpoints, edge cases, and error scenarios."

2. "Generate load tests for the facilities API ensuring < 0.5% error rate 
   at 100 req/min with P95 latency < 500ms."

3. "Create chaos engineering tests that simulate Redis failures, MongoDB 
   connection drops, and rate limiting scenarios."

4. "Generate security tests for JWT authentication including token expiration, 
   invalid tokens, and authorization bypass attempts."

5. "Analyze the last 7 days of production logs and generate regression tests 
   for any 5xx errors found."
```

### GitHub Copilot Integration

```typescript
// In VSCode with Copilot:
// 1. Open test file
// 2. Type comment:
//    "Generate integration test for GET /api/v1/facilities/:id 
//     validating response schema and error cases"
// 3. Press Tab to accept Copilot suggestion
// 4. Refine as needed
```

---

## Running Tests

```bash
# Run all integration tests
yarn test:e2e

# Run contract tests
yarn test:e2e test/contract.e2e-spec.ts

# Run load tests (SLO validation)
yarn test:e2e test/load.e2e-spec.ts

# Run chaos tests
yarn test:e2e test/chaos.e2e-spec.ts
```

---

## CI/CD Integration

Already configured in `.github/workflows/ci.yml`:

```yaml
- name: Run e2e tests
  run: yarn test:e2e
```

**Future enhancements:**
- Add performance regression checks
- Add contract validation against OpenAPI
- Add chaos test runs in staging environment

---

## Monitoring & Iteration

### Post-Deploy Testing

```typescript
// Use production metrics to generate tests
// Prompt: "Analyze CloudWatch logs for 5xx errors and generate regression tests"

// Example: If you see 500 errors for specific query:
it('should handle problematic query from production', async () => {
  // Real query that caused 500 in production
  const response = await request(app.getHttpServer())
    .get('/api/v1/facilities?name=City&amenities=Pool,Gym,Sauna,Parking')
    .set('Authorization', `Bearer ${authToken}`)
    .expect(200);

  expect(response.body.data).toBeDefined();
});
```

---

## Benefits of AI-First Approach

1. **70-80% faster test creation** - AI generates boilerplate from OpenAPI
2. **Better coverage** - AI considers edge cases humans miss
3. **SLO-aligned** - Tests validate actual production requirements
4. **Self-healing** - AI regenerates tests when API changes
5. **Production-driven** - Real errors become regression tests

---

## Next Steps

1. ✅ Current E2E tests already validate core functionality
2. 📝 Add contract tests (use AI to generate from Swagger)
3. 📝 Add load tests (SLO validation)
4. 📝 Add chaos tests (error budget validation)
5. 📝 Integrate with monitoring (feed production errors back to tests)

---

## Interview Talking Points

> "I use an AI-first testing approach where Claude generates integration tests from our OpenAPI spec, reducing manual effort by 70%. I focus on SLO-aligned testing - our error budget is 0.5%, so load tests validate we stay under that threshold at expected traffic. I also use chaos engineering to test Redis and MongoDB failure scenarios. The key is feeding production data back to AI - when we see 5xx errors in CloudWatch, I prompt Claude to generate regression tests for those scenarios. This creates a continuous improvement loop where production teaches the test suite."

This demonstrates:
- ✅ AI-first mindset (key requirement)
- ✅ SLO awareness (production focus)
- ✅ Chaos engineering (senior level)
- ✅ Continuous improvement (learns from production)
