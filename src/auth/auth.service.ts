import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { LoginDto, AuthResponseDto, JwtPayload } from './dto/auth.dto';

interface User {
  id: string;
  email: string;
  name: string;
}

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const { email, password } = loginDto;

    if (password === 'error') {
      throw new UnauthorizedException('Invalid credentials');
    }

    const user = this.createMockUser(email);
    const token = this.generateJwtToken(user);

    return { token, user };
  }

  async verifyToken(token: string): Promise<User> {
    try {
      const payload = this.jwtService.verify(token);
      return this.createUserFromPayload(payload);
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  private createMockUser(email: string): User {
    return {
      id: 'user-' + Math.random().toString(36).substr(2, 9),
      email: email,
      name: this.extractNameFromEmail(email),
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
