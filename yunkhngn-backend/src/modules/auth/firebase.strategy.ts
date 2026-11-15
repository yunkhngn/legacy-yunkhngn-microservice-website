import {
  Injectable,
  UnauthorizedException,
  Logger,
  Inject,
} from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-http-bearer';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { decodeJwtExp, sha256Hex } from '../../common/utils/jwt-decode.util';

const MAX_TTL_SECONDS = 300;

@Injectable()
export class FirebaseStrategy extends PassportStrategy(Strategy, 'firebase') {
  private readonly logger = new Logger(FirebaseStrategy.name);

  constructor(
    private configService: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {
    super();
  }

  async validate(token: string) {
    const cacheKey = `auth:token:${sha256Hex(token).slice(0, 32)}`;
    const cached = await this.cache.get<Record<string, unknown>>(cacheKey);
    if (cached) {
      return cached;
    }

    const user = await this.callAuthService(token);

    const exp = decodeJwtExp(token);
    const nowSec = Math.floor(Date.now() / 1000);
    const ttl = Math.max(0, Math.min(MAX_TTL_SECONDS, exp - nowSec));
    if (ttl > 0) {
      // 5-min cap means admin role revocation is effective within 5 minutes.
      await this.cache.set(cacheKey, user, ttl);
    }
    return user;
  }

  private async callAuthService(token: string) {
    try {
      const authUrl =
        this.configService.get<string>('AUTH_SERVICE_URL') ||
        'http://auth-service:3002';
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
      this.logger.error(
        'Token validation via auth-service failed',
        error instanceof Error ? error.stack : String(error),
      );
      throw new UnauthorizedException('Invalid token');
    }
  }
}
