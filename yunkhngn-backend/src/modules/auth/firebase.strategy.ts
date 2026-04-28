import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-http-bearer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FirebaseStrategy extends PassportStrategy(Strategy, 'firebase') {
  private readonly logger = new Logger(FirebaseStrategy.name);

  constructor(private configService: ConfigService) {
    super();
  }

  async validate(token: string) {
    try {
      const authUrl = this.configService.get<string>('AUTH_SERVICE_URL') || 'http://auth-service:3002';
      
      const response = await fetch(`${authUrl}/auth/validate-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        throw new UnauthorizedException('Invalid token from auth-service');
      }

      return await response.json();
    } catch (error) {
      this.logger.error('Token validation via auth-service failed', error.stack);
      throw new UnauthorizedException('Invalid token');
    }
  }
}
