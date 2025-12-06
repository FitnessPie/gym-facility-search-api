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
