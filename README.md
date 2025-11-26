# FP RESTful Facility Search API

## Overview

A production-ready RESTful API built with NestJS, MongoDB, and Redis for searching and filtering fitness facilities. Features include JWT authentication, caching, rate limiting, pagination, and full Swagger documentation.

## Quick Start (Recommended: Docker)

The easiest way to run the entire application with all dependencies:

```bash
# Start everything with Docker
docker-compose up -d

# Seed the database (optional - for demo data)
docker-compose exec api npx corepack yarn seed
```

#### Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/v1/auth/login` | Get JWT token | ❌ |
| GET | `/api/v1/facilities` | Search/list facilities | ✅ |
| GET | `/api/v1/facilities/:id` | Get facility details | ✅ |
| GET | `/api/v1/health` | Health check | ❌ |

**Swagger docs**: http://localhost:3000/api/docs

---

Note: For the facilities queries that are frequently called, [I cache them using NestJS cache with Redis](https://docs.nestjs.com/techniques/caching).


###  API Authentication

```bash
# Step 1: Login with registered user credentials
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"hi@ph7.me","password":"fp-pierre"}'

# Response:
# {
#   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTJ2aWkyZThzZiIsImVtYWlsIjoiZGVtb0BleGFtcGxlLmNvbSIsIm5hbWUiOiJEZW1vIiwiaWF0IjoxNzMyNjk4MzY3LCJleHAiOjE3MzI3MDU1Njd9.abc123...",
#   "user": {
#     "id": "user-2vii2e8sf",
#     "email": "hi@ph7.me",
#     "name": "Pierre"
#   }
# }

# Step 2: Extract token and use it to access protected resources
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTJ2aWkyZThzZiIsImVtYWlsIjoiZGVtb0BleGFtcGxlLmNvbSIsIm5hbWUiOiJEZW1vIiwiaWF0IjoxNzMyNjk4MzY3LCJleHAiOjE3MzI3MDU1Njd9.abc123..."

# Search facilities
curl "http://localhost:3000/api/v1/facilities?name=City&limit=5" \
  -H "Authorization: Bearer $TOKEN"

# Get specific facility
curl "http://localhost:3000/api/v1/facilities/facility-001" \
  -H "Authorization: Bearer $TOKEN"

# Filter by amenities
curl "http://localhost:3000/api/v1/facilities?amenities=Pool&amenities=Gym" \
  -H "Authorization: Bearer $TOKEN"

# Automated workflow (extract token automatically)
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"hi@ph7.me","password":"fp-pierre"}' \
  | jq -r '.token')

curl "http://localhost:3000/api/v1/facilities?name=Fitness" \
  -H "Authorization: Bearer $TOKEN" | jq .
```


## Documentation

I use [`@nestjs/swagger`](https://docs.nestjs.com/openapi/introduction) to generate the OpenAPI docs.

- **Swagger UI**: http://localhost:3000/api/docs (interactive API documentation)
- **[SETUP_YARN.md](./SETUP_YARN.md)** - Yarn/Corepack setup information


### Setup Steps

```bash
# 1. Start MongoDB and Redis
docker-compose -f docker-compose.dev.yml up -d

# 2. Install dependencies
npx corepack yarn install

# 3. Configure environment
cp .env.example .env

# 4. Seed database (optional)
npx corepack yarn seed

# 5. Start development server
npx corepack yarn start:dev
```
