import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import axios from 'axios';
import { PrismaService } from '../../database/prisma/prisma.service';
import { GalleryService } from '../gallery/gallery.service';
import { CloudinaryService } from '../integrations/cloudinary/cloudinary.service';
import { SettingsService } from '../settings/settings.service';

const LOCKET_AUTH_URL = 'https://auth.locket-dio.com/locket/loginV2';
const LOCKET_DIO_API = 'https://api.locket-dio.com';
const BATCH_LIMIT = 60;
const LOCKET_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36';

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
  ) {}

  // 1st of every month at 02:00
  @Cron('0 2 1 * *')
  async scheduledBackup() {
    this.logger.log('Running scheduled monthly Locket backup');
    try {
      const { imported, skipped } = await this.runBackup();
      this.logger.log(`Scheduled backup done: +${imported} imported, ${skipped} skipped`);
    } catch (err) {
      this.logger.error('Scheduled backup failed:', err.message);
    }
  }

  async runBackup(): Promise<{ imported: number; skipped: number }> {
    if (this.isRunning) {
      throw new Error('Backup đang chạy, vui lòng chờ');
    }

    this.isRunning = true;

    try {
      const [email, password, apiKey] = await Promise.all([
        this.settingsService.getDecryptedSetting('locket_email'),
        this.settingsService.getDecryptedSetting('locket_password'),
        this.settingsService.getDecryptedSetting('locket_api_key'),
      ]);

      if (!email || !password || !apiKey) {
        throw new Error('Chưa cấu hình locket_email/locket_password/locket_api_key trong Admin → Settings → Locket');
      }

      // Always login fresh — idToken expires after 1 hour
      const { idToken, localId } = await this.login(email, password, apiKey);
      this.logger.log(`Logged in to Locket as ${localId}`);

      const moments = await this.fetchAllMoments(idToken, localId, apiKey);
      this.logger.log(`Fetched ${moments.length} moments from Locket`);

      let imported = 0;
      let skipped = 0;

      for (const moment of moments) {
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

  private async login(
    email: string,
    password: string,
    apiKey: string,
  ): Promise<{ idToken: string; localId: string }> {
    const res = await axios.post(
      LOCKET_AUTH_URL,
      { email, password, captchaToken: '' },
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': LOCKET_USER_AGENT,
          Origin: 'https://locket-dio.com',
          Referer: 'https://locket-dio.com/',
          'x-api-key': apiKey,
          'x-app-api': 'v2.2.1',
          'x-app-author': 'dio',
          'x-app-client': 'Beta1.0.1.7',
          'x-app-env': 'production',
          'x-app-name': 'locketdio',
        },
        timeout: 10000,
      },
    );

    const data = res.data?.data ?? res.data;
    const { idToken, localId } = data;
    if (!idToken || !localId) {
      throw new Error('Đăng nhập Locket thất bại: response thiếu idToken/localId');
    }
    return { idToken, localId };
  }

  private async fetchAllMoments(
    idToken: string,
    localId: string,
    apiKey: string,
  ): Promise<LocketMoment[]> {
    const seen = new Set<string>();
    const allMoments: LocketMoment[] = [];
    let timestamp = Math.floor(Date.now() / 1000);
    let consecutiveDupes = 0;

    while (true) {
      let batch: LocketMoment[];
      try {
        batch = await this.fetchBatch({ idToken, timestamp, friendId: localId, apiKey });
      } catch (err) {
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
    apiKey: string;
  }): Promise<LocketMoment[]> {
    const res = await axios.post(
      `${LOCKET_DIO_API}/locket/getMomentV2`,
      { timestamp: params.timestamp, friendId: params.friendId, limit: BATCH_LIMIT },
      {
        headers: {
          Authorization: `Bearer ${params.idToken}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': LOCKET_USER_AGENT,
          Origin: 'https://locket-dio.com',
          Referer: 'https://locket-dio.com/',
          'x-api-key': params.apiKey,
          'x-app-api': 'v2.2.1',
          'x-app-author': 'dio',
          'x-app-client': 'Beta1.0.1.7',
          'x-app-env': 'production',
          'x-app-name': 'locketdio',
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
        return 'Locket Dio login bị từ chối (403). Kiểm tra locket_email/locket_password hoặc locket_api_key.';
      }
      if (url.includes('/locket/getMomentV2')) {
        return 'Locket Dio từ chối lấy moments (403). Token hết hạn hoặc api key sai.';
      }
      return 'Không thể tải media từ Locket (403). Link có thể đã hết hạn hoặc bị chặn.';
    }

    if (status) {
      return `Locket backup thất bại: upstream trả HTTP ${status}.`;
    }

    return error.message || 'Backup Locket thất bại';
  }
}
