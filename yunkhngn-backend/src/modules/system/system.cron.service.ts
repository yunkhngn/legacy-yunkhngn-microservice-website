import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma/prisma.service';
import * as admin from 'firebase-admin';

@Injectable()
export class SystemCronService {
  private readonly logger = new Logger(SystemCronService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Run automatically every day at 3:00 AM
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleFirebaseCleanup() {
    this.logger.log('Starting automated daily Firebase account cleanup...');
    try {
      if (admin.apps.length === 0) {
        this.logger.warn('Firebase Admin not initialized. Skipping cleanup.');
        return;
      }

      // 1. Get admin UIDs from database
      const adminUsers = await this.prisma.user.findMany({
        where: { role: 'ADMIN' },
        select: { uid: true },
      });
      const adminUids = new Set(adminUsers.map((u) => u.uid));

      // 2. List all Firebase users
      const users: admin.auth.UserRecord[] = [];
      let nextPageToken: string | undefined;
      do {
        const result = await admin.auth().listUsers(1000, nextPageToken);
        users.push(...result.users);
        nextPageToken = result.pageToken;
      } while (nextPageToken);

      // 3. Filter non-admins
      const toDelete = users.filter((u) => !adminUids.has(u.uid));
      if (toDelete.length === 0) {
        this.logger.log('No non-admin accounts found. Everything is clean.');
        return;
      }

      this.logger.log(`Found ${toDelete.length} non-admin account(s) to delete.`);

      // 4. Delete in chunks to avoid rate limiting
      for (const u of toDelete) {
        try {
          await admin.auth().deleteUser(u.uid);
          this.logger.log(`Deleted Firebase user: ${u.uid} (${u.email || 'no-email'})`);
        } catch (err) {
          this.logger.error(`Failed to delete Firebase user ${u.uid}: ${err.message}`);
        }
      }

      this.logger.log('Daily Firebase account cleanup finished successfully.');
    } catch (error) {
      this.logger.error('Error executing automated Firebase cleanup:', error.message);
    }
  }
}
