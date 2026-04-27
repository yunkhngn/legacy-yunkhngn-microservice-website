import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env.PORT || '3001', 10),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  selfUrl: process.env.SELF_URL || 'http://localhost:3001',
  encryptionKey: process.env.ENCRYPTION_KEY,
}));
