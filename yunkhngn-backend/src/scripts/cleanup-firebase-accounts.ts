/**
 * Firebase Account Cleanup Script
 *
 * Deletes all Firebase Auth accounts that are NOT admin users in the database.
 * Safe to run multiple times — it only deletes non-admin accounts.
 *
 * Usage: npx ts-node src/scripts/cleanup-firebase-accounts.ts [--dry-run]
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config();

const DRY_RUN = process.argv.includes('--dry-run');

// ── Admin UIDs from database ──
// We query the DB directly via Prisma to get admin UIDs
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function initFirebase() {
  if (admin.apps.length > 0) return;

  const credentials = process.env.FIREBASE_CREDENTIALS;
  if (!credentials) {
    throw new Error('FIREBASE_CREDENTIALS not set');
  }

  let serviceAccount;
  if (credentials.startsWith('{')) {
    serviceAccount = JSON.parse(credentials);
  } else if (fs.existsSync(credentials)) {
    serviceAccount = JSON.parse(fs.readFileSync(credentials, 'utf8'));
  }

  if (!serviceAccount) {
    throw new Error('Could not parse Firebase credentials');
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

async function getAdminUids(): Promise<Set<string>> {
  const adminUsers = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { uid: true },
  });
  return new Set(adminUsers.map((u) => u.uid));
}

async function listAllFirebaseUsers(): Promise<admin.auth.UserRecord[]> {
  const users: admin.auth.UserRecord[] = [];
  let nextPageToken: string | undefined;

  do {
    const result = await admin.auth().listUsers(1000, nextPageToken);
    users.push(...result.users);
    nextPageToken = result.pageToken;
  } while (nextPageToken);

  return users;
}

async function main() {
  console.log(`\n🔥 Firebase Account Cleanup ${DRY_RUN ? '(DRY RUN)' : ''}`);
  console.log('─'.repeat(50));

  await initFirebase();

  // Get admin UIDs from database
  const adminUids = await getAdminUids();
  console.log(`✅ Found ${adminUids.size} admin account(s) in database (protected)`);

  // List all Firebase users
  const allUsers = await listAllFirebaseUsers();
  console.log(`📋 Found ${allUsers.length} total Firebase account(s)\n`);

  // Identify accounts to delete
  const toDelete = allUsers.filter((user) => !adminUids.has(user.uid));

  if (toDelete.length === 0) {
    console.log('✨ No accounts to clean up. Everything is tidy!');
    await prisma.$disconnect();
    return;
  }

  console.log(`🗑️  ${toDelete.length} account(s) to delete:\n`);

  for (const user of toDelete) {
    const info = [
      user.email || 'no-email',
      user.displayName || 'no-name',
      user.providerData?.[0]?.providerId || (user.providerData?.length === 0 ? 'anonymous' : 'unknown'),
      `created: ${user.metadata.creationTime}`,
      `last sign-in: ${user.metadata.lastSignInTime || 'never'}`,
    ].join(' | ');

    if (DRY_RUN) {
      console.log(`  [DRY] Would delete: ${user.uid} (${info})`);
    } else {
      try {
        await admin.auth().deleteUser(user.uid);
        console.log(`  ✅ Deleted: ${user.uid} (${info})`);
      } catch (err) {
        console.error(`  ❌ Failed to delete ${user.uid}:`, err.message);
      }
    }
  }

  console.log(`\n${'─'.repeat(50)}`);
  console.log(
    DRY_RUN
      ? `📌 Dry run complete. ${toDelete.length} account(s) would be deleted. Run without --dry-run to execute.`
      : `🧹 Cleanup complete. Deleted ${toDelete.length} account(s).`,
  );

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  prisma.$disconnect();
  process.exit(1);
});
