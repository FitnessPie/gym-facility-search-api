import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('FacilitiesController (e2e)', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env',
        }),
        AppModule,
      ],
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

    // Login to get auth token
    const loginResponse = await request(app.getHttpServer()).post('/api/v1/auth/login').send({
      email: 'test@example.com',
      password: 'password123',
    });

    authToken = loginResponse.body.token;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/api/v1/facilities (GET)', () => {
    it('should return 401 without auth token', () => {
      return request(app.getHttpServer()).get('/api/v1/facilities?name=City').expect(401);
    });

    it('should get all facilities with valid token', () => {
      return request(app.getHttpServer())
        .get('/api/v1/facilities')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body).toHaveProperty('meta');
          expect(Array.isArray(res.body.data)).toBe(true);
          expect(res.body.meta).toHaveProperty('total');
          expect(res.body.meta).toHaveProperty('page');
          expect(res.body.meta).toHaveProperty('limit');
          expect(res.body.meta).toHaveProperty('totalPages');
        });
    });

    it('should filter facilities by name with partial matching', () => {
      return request(app.getHttpServer())
        .get('/api/v1/facilities?name=City')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeDefined();
          expect(Array.isArray(res.body.data)).toBe(true);
        });
    });

    it('should filter by amenities', () => {
      return request(app.getHttpServer())
        .get('/api/v1/facilities?name=City&amenities=Pool,Sauna')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeDefined();
          if (res.body.data.length > 0) {
            const facility = res.body.data[0];
            expect(facility.facilities).toContain('Pool');
            expect(facility.facilities).toContain('Sauna');
          }
        });
    });

    it('should support pagination', () => {
      return request(app.getHttpServer())
        .get('/api/v1/facilities?name=Fitness&page=1&limit=5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.meta.page).toBe(1);
          expect(res.body.meta.limit).toBe(5);
          expect(res.body.data.length).toBeLessThanOrEqual(5);
        });
    });
  });

  describe('/api/v1/facilities/:id (GET)', () => {
    it('should return 401 without auth token', () => {
      return request(app.getHttpServer()).get('/api/v1/facilities/facility-001').expect(401);
    });

    it('should get facility by ID', () => {
      return request(app.getHttpServer())
        .get('/api/v1/facilities/facility-001')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body).toHaveProperty('name');
          expect(res.body).toHaveProperty('address');
          expect(res.body).toHaveProperty('location');
          expect(res.body).toHaveProperty('facilities');
          expect(res.body.location).toHaveProperty('latitude');
          expect(res.body.location).toHaveProperty('longitude');
        });
    });

    it('should return 404 for non-existent facility', () => {
      return request(app.getHttpServer())
        .get('/api/v1/facilities/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('/api/v1/facilities/amenities (GET)', () => {
    it('should return list of amenities', () => {
      return request(app.getHttpServer())
        .get('/api/v1/facilities/amenities')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          if (res.body.length > 0) {
            expect(typeof res.body[0]).toBe('string');
          }
        });
    });
  });
});

describe('AuthController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/api/v1/auth/login (POST)', () => {
    it('should login successfully', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('token');
          expect(res.body).toHaveProperty('user');
          expect(res.body.user).toHaveProperty('email');
          expect(res.body.user).toHaveProperty('name');
          expect(res.body.user).toHaveProperty('membershipType');
        });
    });

    it('should return 401 for invalid credentials', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'error',
        })
        .expect(401);
    });

    it('should return 400 for invalid email format', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'invalid-email',
          password: 'password123',
        })
        .expect(400);
    });
  });
});
