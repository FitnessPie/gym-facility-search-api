# FP Facility Search API

RESTful API for searching fitness facilities. Built with NestJS, MongoDB, and Redis.

## Quick Start

```bash
docker-compose up -d
docker-compose exec api npx corepack yarn seed
```

**API**: http://localhost:3000/api/v1  
**Docs**: http://localhost:3000/api/docs

## Endpoints

| Method | Endpoint | Auth |
|--------|----------|------|
| POST | `/api/v1/auth/login` | No |
| GET | `/api/v1/facilities` | Yes |
| GET | `/api/v1/facilities/:id` | Yes |
| GET | `/api/v1/health` | No |

## API Authentication

```bash
# Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"hi@ph7.me","password":"fp-pierre"}'

# Use token
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"hi@ph7.me","password":"fp-pierre"}' | jq -r '.token')

curl "http://localhost:3000/api/v1/facilities?name=City&limit=5" \
  -H "Authorization: Bearer $TOKEN"
```

## Documentation

I use [`@nestjs/swagger`](https://docs.nestjs.com/openapi/introduction) to generate the OpenAPI docs.

