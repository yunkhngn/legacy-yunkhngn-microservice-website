import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SettingsService } from '../../settings/settings.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import axios from 'axios';

export interface WakaTimeToday {
  text: string;
  total_seconds: number;
  top_language: string | null;
  is_coding_now: boolean;
  last_heartbeat_at: string | null;
}

const ACTIVE_THRESHOLD_MS = 5 * 60 * 1000;
const CACHE_TTL_SECONDS = 60;

@Injectable()
export class WakaTimeService {
  private readonly logger = new Logger(WakaTimeService.name);
  private readonly baseUrl = 'https://wakatime.com/api/v1';

  constructor(
    private configService: ConfigService,
    private settingsService: SettingsService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  private async getApiKey(): Promise<string | null> {
    return (
      (await this.settingsService.getDecryptedSetting('wakatime_api_key')) ||
      this.configService.get<string>('WAKATIME_API_KEY') ||
      null
    );
  }

  async getToday(): Promise<WakaTimeToday | null> {
    const cacheKey = 'wakatime_today';
    const cached = await this.cacheManager.get<WakaTimeToday>(cacheKey);
    if (cached) return cached;

    const apiKey = await this.getApiKey();
    if (!apiKey) {
      this.logger.warn('WakaTime API key not configured');
      return null;
    }

    try {
      const authHeader = Buffer.from(apiKey).toString('base64');
      const headers = { Authorization: `Basic ${authHeader}` };
      const today = new Date().toISOString().slice(0, 10);

      const [summariesRes, heartbeatsRes] = await Promise.all([
        axios.get(`${this.baseUrl}/users/current/summaries`, {
          params: { range: 'Today' },
          headers,
        }),
        axios
          .get(`${this.baseUrl}/users/current/heartbeats`, {
            params: { date: today },
            headers,
          })
          .catch((err) => {
            this.logger.warn(
              `WakaTime heartbeats fetch failed: ${(err as Error).message}`,
            );
            return { data: { data: [] } };
          }),
      ]);

      const summary = summariesRes.data?.data?.[0];
      if (!summary) return null;

      const totalSeconds = summary.grand_total?.total_seconds ?? 0;
      if (totalSeconds === 0) return null;

      const heartbeats: Array<{ time: number }> =
        heartbeatsRes.data?.data ?? [];
      const lastHeartbeat = heartbeats[heartbeats.length - 1];
      const lastHeartbeatMs = lastHeartbeat
        ? Math.round(lastHeartbeat.time * 1000)
        : null;
      const isCodingNow = lastHeartbeatMs
        ? Date.now() - lastHeartbeatMs < ACTIVE_THRESHOLD_MS
        : false;

      const result: WakaTimeToday = {
        text: summary.grand_total?.text ?? '',
        total_seconds: totalSeconds,
        top_language: summary.languages?.[0]?.name ?? null,
        is_coding_now: isCodingNow,
        last_heartbeat_at: lastHeartbeatMs
          ? new Date(lastHeartbeatMs).toISOString()
          : null,
      };

      // TTL in seconds. Kept short so is_coding_now stays fresh.
      await this.cacheManager.set(cacheKey, result, CACHE_TTL_SECONDS);
      return result;
    } catch (error: any) {
      this.logger.error(
        `Failed to fetch WakaTime data: ${error.message}`,
        error.stack,
      );
      return null;
    }
  }
}
