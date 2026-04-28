import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  async validateToken(token: string) {
    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      
      // In a real scenario, you'd sync with DB here or via an event
      // For now, return decoded token info
      return {
        ...decodedToken,
        // Mock role for now, in Step B4 we'd fetch this from shared DB
        role: 'ADMIN', 
        isAdmin: true,
      };
    } catch (error) {
      this.logger.error('Firebase token verification failed', error.stack);
      throw new UnauthorizedException('Invalid token');
    }
  }
}
