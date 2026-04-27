import { registerAs } from '@nestjs/config';

export default registerAs('firebase', () => ({
    credentials: process.env.FIREBASE_CREDENTIALS,
}));
