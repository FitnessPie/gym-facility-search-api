import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { LoginDto, AuthResponseDto, JwtPayload } from './dto/auth.dto';

interface User {
  id: string;
  email: string;
  name: string;
}

const DEMO_USER_EMAIL = 'hi@ph7.me';
const DEMO_USER_NAME = 'Pierre';
const INVALID_CREDENTIALS_MESSAGE = 'Invalid credentials';
const INVALID_TOKEN_MESSAGE = 'Invalid token';
const USER_ID_PREFIX = 'user-';
const MIN_PASSWORD_LENGTH = 6;

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) { }

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const { email, password } = loginDto;

    this.validateCredentials(password);

    const user = this.createMockUser(email);
    const token = this.generateJwtToken(user);

    return { token, user };
  }

  private validateCredentials(password: string): void {
    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }
  }

  async verifyToken(token: string): Promise<User> {
    try {
      const payload = this.jwtService.verify(token);
      return this.createUserFromPayload(payload);
    } catch {
      throw new UnauthorizedException(INVALID_TOKEN_MESSAGE);
    }
  }

  private createMockUser(email: string): User {
    const name = email === DEMO_USER_EMAIL
      ? DEMO_USER_NAME
      : this.extractNameFromEmail(email);

    return {
      id: USER_ID_PREFIX + randomUUID(),
      email,
      name,
    };
  }

  private generateJwtToken(user: User): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
    };

    return this.jwtService.sign(payload);
  }

  private createUserFromPayload(payload: any): User {
    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
    };
  }
  private extractNameFromEmail(email: string): string {
    const username = email.split('@')[0];
    return username
      .split(/[._-]/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }
}
