import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import axios from 'axios';
import { PrismaService } from '../../database/prisma/prisma.service';
import { GalleryService } from '../gallery/gallery.service';
import { CloudinaryService } from '../integrations/cloudinary/cloudinary.service';
import { SettingsService } from '../settings/settings.service';
import { NotificationsService } from '../notifications/notifications.service';

const LOCKET_API = 'https://api.locket-dio.com';
const LOCKET_AUTH_URL = 'https://auth.locket-dio.com/locket/loginV2';
const LOCKET_API_KEY = 'LKD-LOCKETDIO-AB02F55KYM55DD02MM03YY25-LKD';
const BATCH_LIMIT = 60;

interface LocketMoment {
  uid: string;
  user: string;
  date: number;
  thumbnail_url: string;
  video_url?: string;
  caption?: string;
}

export interface BackupResult {
  ran_at: string;
  imported: number;
  skipped: number;
  error?: string;
}

@Injectable()
export class LocketBackupService {
  private readonly logger = new Logger(LocketBackupService.name);
  private isRunning = false;
  private lastResult: BackupResult | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly galleryService: GalleryService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly settingsService: SettingsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // 1st of every month at 02:00
  @Cron('0 2 1 * *')
  async scheduledBackup() {
    this.logger.log('Running scheduled monthly Locket backup');
    try {
      const { imported, skipped } = await this.runBackup();
      await this.notificationsService.create(
        'locket_backup',
        `Locket backup thành công: +${imported} ảnh mới, bỏ qua ${skipped} trùng.`,
        '/admin/photo',
      );
    } catch (err) {
      this.logger.error('Scheduled backup failed:', err.message);
      await this.notificationsService.create(
        'locket_backup_error',
        `Locket backup thất bại: ${err.message}`,
        '/admin/settings',
      );
    }
  }

  async runBackup(): Promise<{ imported: number; skipped: number }> {
    if (this.isRunning) {
      throw new Error('Backup đang chạy, vui lòng chờ');
    }

    this.isRunning = true;

    try {
      const [email, password] = await Promise.all([
        this.settingsService.getDecryptedSetting('locket_email'),
        this.settingsService.getDecryptedSetting('locket_password'),
      ]);

      if (!email || !password) {
        throw new Error('Chưa cấu hình locket_email hoặc locket_password trong Admin → Settings → Locket');
      }

      // Always login fresh — idToken expires after 1 hour
      const { idToken, localId } = await this.login(email, password);
      this.logger.log(`Logged in to Locket as ${localId}`);

      const moments = await this.fetchAllMoments(idToken, localId);
      this.logger.log(`Fetched ${moments.length} moments from Locket`);

      let imported = 0;
      let skipped = 0;

      for (const moment of moments) {
        // Match full JSON key to avoid substring false positives
        const exists = await this.prisma.gallery.findFirst({
          where: { exifData: { contains: `"uid":"${moment.uid}"` } },
          select: { id: true },
        });

        if (exists) {
          skipped++;
          continue;
        }

        try {
          const isVideo = !!moment.video_url;
          const mediaUrl = isVideo ? moment.video_url : moment.thumbnail_url;

          const buffer = await this.downloadFile(mediaUrl);

          const date = new Date(moment.date * 1000);
          const dateStr = date
            .toISOString()
            .replace('T', '_')
            .replace(/:/g, '-')
            .slice(0, 19);

          // public_id must NOT include folder prefix — Cloudinary concatenates folder + public_id
          const uploaded = await this.cloudinaryService.uploadBuffer(
            buffer,
            'locket',
            {
              public_id: `${dateStr}_${moment.uid}`,
              resource_type: isVideo ? 'video' : 'image',
            },
          );

          await this.galleryService.create({
            imageUrl: uploaded.secure_url,
            caption: moment.caption || null,
            tags: 'locket',
            exifData: JSON.stringify({
              source: 'locket',
              uid: moment.uid,
              date: moment.date,
              ...(isVideo && { video_url: moment.video_url, thumbnail_url: moment.thumbnail_url }),
            }),
            sortOrder: 0,
            width: uploaded.width,
            height: uploaded.height,
          });

          imported++;
          await new Promise((r) => setTimeout(r, 200));
        } catch (err) {
          this.logger.warn(`Skip moment ${moment.uid}: ${err.message}`);
        }
      }

      this.lastResult = {
        ran_at: new Date().toISOString(),
        imported,
        skipped,
      };

      this.logger.log(`Backup done: ${imported} imported, ${skipped} skipped`);
      return { imported, skipped };
    } catch (err) {
      const message = this.getBackupErrorMessage(err);
      this.lastResult = {
        ran_at: new Date().toISOString(),
        imported: 0,
        skipped: 0,
        error: message,
      };
      throw new Error(message);
    } finally {
      this.isRunning = false;
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      lastResult: this.lastResult,
    };
  }

  private async login(email: string, password: string): Promise<{ idToken: string; localId: string }> {
    const res = await axios.post(
      LOCKET_AUTH_URL,
      { email, password, captchaToken: '' },
      {
        headers: {
          'x-api-key': LOCKET_API_KEY,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      },
    );

    const { idToken, localId } = res.data;
    if (!idToken || !localId) {
      throw new Error('Đăng nhập Locket thất bại: response thiếu idToken/localId');
    }
    return { idToken, localId };
  }

  private async fetchAllMoments(idToken: string, localId: string): Promise<LocketMoment[]> {
    const seen = new Set<string>();
    const allMoments: LocketMoment[] = [];
    let timestamp = Math.floor(Date.now() / 1000);
    let consecutiveDupes = 0;

    while (true) {
      let batch: LocketMoment[];
      try {
        batch = await this.fetchBatch({ idToken, timestamp, friendId: localId });
      } catch (err) {
        // A single batch failure should not abort previously fetched moments
        this.logger.warn(`Batch fetch failed at timestamp ${timestamp}: ${err.message}. Stopping pagination.`);
        break;
      }

      if (!batch?.length) break;

      let newInBatch = 0;
      for (const moment of batch) {
        if (!seen.has(moment.uid)) {
          seen.add(moment.uid);
          allMoments.push(moment);
          newInBatch++;
        }
      }

      if (newInBatch === 0) {
        consecutiveDupes++;
        if (consecutiveDupes >= 2) break;
      } else {
        consecutiveDupes = 0;
      }

      timestamp = batch[batch.length - 1].date;
      await new Promise((r) => setTimeout(r, 300));
    }

    return allMoments;
  }

  private async fetchBatch(params: {
    idToken: string;
    timestamp: number;
    friendId: string;
  }): Promise<LocketMoment[]> {
    const res = await axios.post(
      `${LOCKET_API}/locket/getMomentV2`,
      { timestamp: params.timestamp, friendId: params.friendId, limit: BATCH_LIMIT },
      {
        headers: {
          Authorization: `Bearer ${params.idToken}`,
          'x-api-key': LOCKET_API_KEY,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      },
    );
    return res.data?.data ?? [];
  }

  private async downloadFile(url: string): Promise<Buffer> {
    const res = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    return Buffer.from(res.data);
  }

  private getBackupErrorMessage(error: unknown): string {
    if (!axios.isAxiosError(error)) {
      return error instanceof Error ? error.message : 'Backup Locket thất bại';
    }

    const status = error.response?.status;
    const url = error.config?.url ?? '';

    if (status === 403) {
      if (url.includes('/locket/loginV2')) {
        return 'Locket login bị từ chối (403). Kiểm tra lại locket_email/locket_password trong Settings.';
      }

      if (url.includes('/locket/getMomentV2')) {
        return 'Locket API từ chối lấy moments (403). Token/API key Locket không còn hợp lệ hoặc tài khoản không có quyền truy cập.';
      }

      return 'Không thể tải media từ Locket/Firebase (403). Một số link media có thể đã hết hạn hoặc bị chặn.';
    }

    if (status) {
      return `Locket backup thất bại: upstream trả HTTP ${status}.`;
    }

    return error.message || 'Backup Locket thất bại';
  }
}
