/**
 * Set Firebase Admin Custom Claim
 *
 * Mints `admin: true` custom claim on all users with role=ADMIN in DB.
 * Required for Firebase RTDB security rules on /status/admin.
 *
 * Usage: npx ts-node src/scripts/set-admin-claim.ts
 *
 * After running, the admin must sign out and back in for the claim
 * to take effect (claims are baked into the ID token at issue time).
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();
const prisma = new PrismaClient();

async function initFirebase() {
  if (admin.apps.length > 0) return;
  const credentials = process.env.FIREBASE_CREDENTIALS;
  if (!credentials) throw new Error('FIREBASE_CREDENTIALS not set');

  let serviceAccount;
  if (credentials.startsWith('{')) {
    serviceAccount = JSON.parse(credentials);
  } else if (fs.existsSync(credentials)) {
    serviceAccount = JSON.parse(fs.readFileSync(credentials, 'utf8'));
  }
  if (serviceAccount) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    console.log('Firebase Admin initialized with credentials.');
  } else {
    admin.initializeApp();
    console.log('Firebase Admin initialized with default credentials.');
  }
}

async function main() {
  console.log('\n🔥 Setting Firebase admin custom claim');
  console.log('─'.repeat(50));

  await initFirebase();

  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { uid: true, email: true },
  });
  console.log(`Found ${admins.length} admin user(s)`);

  for (const u of admins) {
    await admin.auth().setCustomUserClaims(u.uid, { admin: true });
    console.log(`✅ Set admin claim on ${u.email} (uid=${u.uid})`);
  }

  console.log(
    '\nDone. Admins must sign out and back in for the claim to take effect.',
  );
  await prisma.$disconnect();
  await admin.app().delete();
}

main().catch((err) => {
  console.error(err);
  prisma.$disconnect();
  process.exit(1);
});
