import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import axios from 'axios';
import { PrismaService } from '../../database/prisma/prisma.service';
import { GalleryService } from '../gallery/gallery.service';
import { CloudinaryService } from '../integrations/cloudinary/cloudinary.service';
import { SettingsService } from '../settings/settings.service';

const LOCKET_AUTH_URL = 'https://auth.locket-dio.com/locket/loginV2';
const LOCKET_FIRESTORE_URL =
  'https://firestore.googleapis.com/v1/projects/locket-4252a/databases/(default)/documents';
const LOCKET_DIO_API_KEY = 'LKD-LOCKETDIO-AB02F55KYM55DD02MM03YY25-LKD';
const BATCH_LIMIT = 100;
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

interface FirestoreValue {
  stringValue?: string;
  integerValue?: string;
  doubleValue?: number;
  booleanValue?: boolean;
  timestampValue?: string;
  mapValue?: { fields?: Record<string, FirestoreValue> };
  arrayValue?: { values?: FirestoreValue[] };
}

interface FirestoreDocument {
  name: string;
  fields?: Record<string, FirestoreValue>;
  createTime?: string;
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

  private async login(
    email: string,
    password: string,
  ): Promise<{ idToken: string; localId: string }> {
    const res = await axios.post(
      LOCKET_AUTH_URL,
      {
        email,
        password,
        captchaToken: '',
      },
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': LOCKET_USER_AGENT,
          Origin: 'https://locket-dio.com',
          Referer: 'https://locket-dio.com/',
          'x-api-key': LOCKET_DIO_API_KEY,
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

  private async fetchAllMoments(idToken: string, localId: string): Promise<LocketMoment[]> {
    const seen = new Set<string>();
    const allMoments: LocketMoment[] = [];
    let pageToken: string | null = null;
    let consecutiveDupes = 0;

    while (true) {
      let result: { moments: LocketMoment[]; nextPageToken: string | null };
      try {
        result = await this.fetchBatch({ idToken, localId, pageToken });
      } catch (err) {
        // A single batch failure should not abort previously fetched moments
        this.logger.warn(`Batch fetch failed at pageToken ${pageToken ?? 'first'}: ${err.message}. Stopping pagination.`);
        break;
      }

      const batch = result.moments;
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

      pageToken = result.nextPageToken;
      if (!pageToken) break;
      await new Promise((r) => setTimeout(r, 300));
    }

    return allMoments;
  }

  private async fetchBatch(params: {
    idToken: string;
    localId: string;
    pageToken: string | null;
  }): Promise<{ moments: LocketMoment[]; nextPageToken: string | null }> {
    const res = await axios.get(
      `${LOCKET_FIRESTORE_URL}/history/${params.localId}/entries`,
      {
        params: {
          orderBy: 'date desc',
          pageSize: BATCH_LIMIT,
          ...(params.pageToken && { pageToken: params.pageToken }),
        },
        headers: {
          Authorization: `Bearer ${params.idToken}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': LOCKET_USER_AGENT,
          'X-Ios-Bundle-Identifier': 'com.locket.Locket',
        },
        timeout: 15000,
      },
    );

    const documents = (res.data?.documents ?? []) as FirestoreDocument[];
    return {
      moments: documents.map((doc) => this.normalizeMoment(doc)).filter(Boolean),
      nextPageToken: res.data?.nextPageToken ?? null,
    };
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
        return 'Locket Dio login bị từ chối (403). Kiểm tra locket_email/locket_password hoặc header x-api-key/x-app-* đã thay đổi.';
      }

      if (url.includes('/history/')) {
        return 'Firestore từ chối lấy moments (403). Token Locket không hợp lệ hoặc tài khoản không có quyền đọc history.';
      }

      return 'Không thể tải media từ Locket/Firebase (403). Một số link media có thể đã hết hạn hoặc bị chặn.';
    }

    if (status) {
      return `Locket backup thất bại: upstream trả HTTP ${status}.`;
    }

    return error.message || 'Backup Locket thất bại';
  }

  private normalizeMoment(doc: FirestoreDocument): LocketMoment | null {
    const fields = doc.fields;
    if (!fields) return null;

    const uid =
      this.parseFirestoreValue(fields.canonical_uid) ||
      doc.name.split('/').pop();
    const dateValue = this.parseFirestoreValue(fields.date) || doc.createTime;
    const date = this.toUnixSeconds(dateValue);
    const thumbnailUrl = this.replaceFirebaseWithCdn(
      this.parseFirestoreValue(fields.thumbnail_url),
    );
    const videoUrl = this.replaceFirebaseWithCdn(
      this.parseFirestoreValue(fields.video_url),
    );

    if (!uid || !date || !thumbnailUrl) return null;

    return {
      uid,
      user: this.parseFirestoreValue(fields.user),
      date,
      thumbnail_url: thumbnailUrl,
      video_url: videoUrl || undefined,
      caption: this.parseFirestoreValue(fields.caption) || undefined,
    };
  }

  private parseFirestoreValue(value?: FirestoreValue): any {
    if (!value) return null;
    if (value.stringValue !== undefined) return value.stringValue;
    if (value.integerValue !== undefined) return parseInt(value.integerValue, 10);
    if (value.doubleValue !== undefined) return value.doubleValue;
    if (value.booleanValue !== undefined) return value.booleanValue;
    if (value.timestampValue !== undefined) return value.timestampValue;
    if (value.mapValue !== undefined) {
      const fields = value.mapValue.fields || {};
      return Object.fromEntries(
        Object.entries(fields).map(([key, field]) => [
          key,
          this.parseFirestoreValue(field),
        ]),
      );
    }
    if (value.arrayValue !== undefined) {
      return (value.arrayValue.values || []).map((item) =>
        this.parseFirestoreValue(item),
      );
    }
    return null;
  }

  private toUnixSeconds(value: unknown): number | null {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = Date.parse(value);
      return Number.isNaN(parsed) ? null : Math.floor(parsed / 1000);
    }
    return null;
  }

  private replaceFirebaseWithCdn(url: unknown): string | null {
    if (typeof url !== 'string' || !url) return null;
    return url.replace(
      'https://firebasestorage.googleapis.com',
      'https://cdn.locketcamera.com',
    );
  }
}
