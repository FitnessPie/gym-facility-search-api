# FP Facility Search API

RESTful API for searching fitness facilities. Built with NestJS, MongoDB, and Redis.

## API Quick Start

```bash
docker-compose up -d
npx corepack yarn seed
```

**API**: http://localhost:3000/api/v1
**Docs**: http://localhost:3000/api/docs

### Endpoints

| Method | Endpoint | Auth |
|--------|----------|------|
| POST | `/api/v1/auth/login` | No |
| GET | `/api/v1/facilities` | Yes |
| GET | `/api/v1/facilities/:id` | Yes |
| GET | `/api/v1/health` | No |

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

**Query Parameters:**
- `name` - Search by facility name
- `amenities` - Filter by amenitie(s)
- `page` - Page number for pagination
- `limit` - Results per page


## Documentation

[`@nestjs/swagger`](https://docs.nestjs.com/openapi/introduction) was used to generate OpenAPI documentation.


## Dev (using Yarn 4 - without using docker)

```bash
yarn install
yarn start:dev

# Run tests
yarn test
```
