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
# Get authentication token
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Use the token to search facilities
curl http://localhost:3000/api/v1/facilities?name=City \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
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
