import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: JwtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock-jwt-token'),
            verify: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    it('should return token and user on successful login', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      const result = await service.login(loginDto);

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('user');
      expect(result.user.email).toBe('test@example.com');
      expect(result.user.name).toBe('Test');
      expect(jwtService.sign).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for invalid credentials', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'short',
      };

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for empty password', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: '',
      };

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for empty password', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: '',
      };

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should extract name from email', async () => {
      const loginDto = {
        email: 'john.doe@example.com',
        password: 'password123',
      };

      const result = await service.login(loginDto);

      expect(result.user.name).toBe('John Doe');
    });
  });

  describe('verifyToken', () => {
    it('should verify valid token', async () => {
      const mockPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        membershipType: 'premium',
      };
      (jwtService.verify as jest.Mock).mockReturnValue(mockPayload);

      const result = await service.verifyToken('valid-token');

      expect(result.id).toBe('user-123');
      expect(result.email).toBe('test@example.com');
      expect(jwtService.verify).toHaveBeenCalledWith('valid-token');
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      (jwtService.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.verifyToken('invalid-token')).rejects.toThrow(UnauthorizedException);
    });
  });
});
