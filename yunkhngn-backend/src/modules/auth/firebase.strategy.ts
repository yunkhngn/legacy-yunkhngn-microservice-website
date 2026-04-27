import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-http-bearer';
import * as admin from 'firebase-admin';
import { UserService } from '../user/user.service';

@Injectable()
export class FirebaseStrategy extends PassportStrategy(Strategy, 'firebase') {
  private readonly logger = new Logger(FirebaseStrategy.name);

  constructor(private userService: UserService) {
    super();
  }

  async validate(token: string) {
    try {
      const decodedToken = await admin.auth().verifyIdToken(token);

      // Sync user to DB
      const user = await this.userService.createOrUpdate(
        decodedToken.uid,
        decodedToken.email,
        decodedToken.picture,
        decodedToken.name,
      );

      // Attach user role from DB to request object
      return {
        ...decodedToken,
        role: user.role,
        isAdmin: user.role === 'ADMIN',
      };
    } catch (error) {
      this.logger.error('Firebase token verification failed', error.stack);
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(
            Buffer.from(parts[1], 'base64').toString(),
          );
          this.logger.debug(
            `Token payload (aud/iss): aud=${payload.aud}, iss=${payload.iss}`,
          );
        }
      } catch (e) {
        this.logger.error('Failed to decode token for debugging', e.stack);
      }
      throw new UnauthorizedException('Invalid token');
    }
  }
}
