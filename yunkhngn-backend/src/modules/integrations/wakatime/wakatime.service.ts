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
}

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
      const { data } = await axios.get(
        `${this.baseUrl}/users/current/summaries`,
        {
          params: { range: 'Today' },
          headers: { Authorization: `Basic ${authHeader}` },
        },
      );

      const summary = data?.data?.[0];
      if (!summary) return null;

      const totalSeconds = summary.grand_total?.total_seconds ?? 0;
      if (totalSeconds === 0) return null;

      const result: WakaTimeToday = {
        text: summary.grand_total?.text ?? '',
        total_seconds: totalSeconds,
        top_language: summary.languages?.[0]?.name ?? null,
      };

      await this.cacheManager.set(cacheKey, result, 300);
      return result;
    } catch (error) {
      this.logger.error('Failed to fetch WakaTime data', error);
      return null;
    }
  }
}
