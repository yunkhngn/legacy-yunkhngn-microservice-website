import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as admin from 'firebase-admin';
import * as fs from 'fs';

async function bootstrap() {
  // Initialize Firebase Admin
  if (admin.apps.length === 0) {
    const credentials = process.env.FIREBASE_CREDENTIALS;
    if (credentials) {
      try {
        let serviceAccount;
        if (credentials.startsWith('{')) {
          serviceAccount = JSON.parse(credentials);
        } else if (fs.existsSync(credentials)) {
          serviceAccount = JSON.parse(fs.readFileSync(credentials, 'utf8'));
        }

        if (serviceAccount) {
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
          });
          console.log('Firebase Admin initialized.');
        }
      } catch (e) {
        console.error('Failed to parse Firebase credentials:', e);
      }
    } else {
      try {
        admin.initializeApp();
        console.log('Firebase Admin initialized with default credentials.');
      } catch (e) {
        console.warn('Firebase Admin initialization failed:', e.message);
      }
    }
  }

  const app = await NestFactory.create(AppModule);
  app.enableCors();
  await app.listen(3002);
  console.log(`Auth service is running on port 3002`);
}
bootstrap();
