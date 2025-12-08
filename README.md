# Gym Facility Search API

RESTful API for searching fitness facilities. Built with NestJS, MongoDB, and Redis.

## Quick Start

### Production
```bash
docker-compose up -d
npx corepack yarn seed
```

### Development (Choose One)

**Option 1: Docker with hot-reload (full isolation)**

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

[`@nestjs/swagger`](https://docs.nestjs.com/openapi/introduction) was used to generate OpenAPI documentation.


**Option 2: Using Yarn (v4) - Fastest option for code changes**
```bash
# Start dependencies only
docker-compose up -d mongodb redis

# Install project dependencies
yarn install

# Run API locally
yarn start:dev
```

**API**: http://localhost:3000/api/v1
**Docs**: http://localhost:3000/api/docs


### Postman Collection

`api-client-collections/postman` is the Postman collection for authentication and requesting easily the endpoints.


## API Authentication

```bash
# Login
BEARER_TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"hi@ph7.me","password":"fp-pierre"}' | jq -r '.token')

# Search facilities (and passing auth token from above to request the endpoint)
curl "http://localhost:3000/api/v1/facilities?name=City&limit=5" \
  -H "Authorization: Bearer $BEARER_TOKEN"
```

**Query Params for `/api/v1/facilities`**
- `name` - Search by facility name
- `amenities` - Filter by amenitie(s)
- `page` - Page number for pagination
- `limit` - Results per page

---

Note: For the facilities queries that are frequently called, [I cache them using NestJS cache with Redis](https://docs.nestjs.com/techniques/caching) and [@nestjs/throttler](https://docs.nestjs.com/security/rate-limiting) for Rate Limiting.

## Documentation

[`@nestjs/swagger`](https://docs.nestjs.com/openapi/introduction) was used to generate OpenAPI documentation at `/api/docs`.

## Testing

### Run Tests

```bash
# Unit tests
yarn test

# E2E tests (requires MongoDB and Redis running first)
docker-compose up -d mongodb redis
yarn seed
yarn test:e2e

# Test coverage
yarn test:cov

# Watch mode
yarn test:watch
```

### Integration Testing (AI-First Approach)

We implement comprehensive integration testing using AI-first methodologies:

- **Contract Tests**: Schema validation from OpenAPI spec
- **Load Tests**: SLO-aligned performance testing (P95 < 500ms)
- **Chaos Tests**: Resilience and failure scenario validation
- **🆕 SLO Tests**: Production-grade error budget tracking (Google SRE model)

**Test Results**: 62 integration tests validating production behavior
- ✅ API schema compliance
- ✅ 36x cache speedup measured
- ✅ Security (XSS, SQL injection protection)
- ✅ Graceful degradation (Redis/MongoDB failures)
- ✅ **Error budget tracking (99.5% availability SLO)**
- ✅ **Burst traffic handling (50 concurrent requests)**
- ✅ **Latency SLOs (P95 < 500ms, P99 < 1000ms)**

**📚 Complete Testing Documentation:**
- [TESTING-SUMMARY.md](./TESTING-SUMMARY.md) - Overview & results
- [INTEGRATION-TESTING.md](./docs/INTEGRATION-TESTING.md) - Implementation guide
- [AI-FIRST-TESTING.md](./docs/AI-FIRST-TESTING.md) - Strategy & AI prompts
- **🆕 [SLO-ERROR-BUDGET-MODEL.md](./docs/SLO-ERROR-BUDGET-MODEL.md) - Production SRE practices**
- **🆕 [SLO-TESTING-CHANGES.md](./docs/SLO-TESTING-CHANGES.md) - Detailed implementation guide**

**Production Load Testing**: Use Artillery or k6 for realistic load testing (documented in guides above).

## 🚀 Deployment

This API can be deployed anywhere - Docker or Serverless.

### Quick Deploy to Vercel (2 minutes)

```bash
npm i -g vercel
vercel --prod
```

### Quick Deploy to AWS Lambda

```bash
npm i -g serverless
serverless deploy --stage prod
```

### Traditional Deployment

```bash
# Deploy Docker container to any platform
docker-compose up -d
```
