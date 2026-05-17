import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SettingsService } from '../../settings/settings.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import axios from 'axios';

export interface SteamNowPlaying {
  name: string;
  app_id?: number;
}

@Injectable()
export class SteamService {
  private readonly logger = new Logger(SteamService.name);
  private readonly baseUrl = 'https://api.steampowered.com';

  constructor(
    private configService: ConfigService,
    private settingsService: SettingsService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  private async getApiKey(): Promise<string | null> {
    return (
      (await this.settingsService.getDecryptedSetting('steam_api_key')) ||
      this.configService.get<string>('STEAM_API_KEY') ||
      null
    );
  }

  private async getUserId(): Promise<string | null> {
    return (
      (await this.settingsService.getDecryptedSetting('steam_user_id')) ||
      this.configService.get<string>('STEAM_USER_ID') ||
      null
    );
  }

  async getNowPlaying(): Promise<SteamNowPlaying | null> {
    const cacheKey = 'steam_now_playing';
    const cached = await this.cacheManager.get<SteamNowPlaying>(cacheKey);
    if (cached) return cached;

    const apiKey = await this.getApiKey();
    const userId = await this.getUserId();
    if (!apiKey || !userId) {
      this.logger.warn('Steam API key or user ID not configured');
      return null;
    }

    try {
      const { data } = await axios.get(
        `${this.baseUrl}/ISteamUser/GetPlayerSummaries/v2/`,
        { params: { key: apiKey, steamids: userId } },
      );

      const player = data?.response?.players?.[0];
      const gameName: string | undefined = player?.gameextrainfo;
      const gameId: string | undefined = player?.gameid;

      if (!gameName) return null;

      const result: SteamNowPlaying = {
        name: gameName,
        app_id: gameId ? Number(gameId) : undefined,
      };
      await this.cacheManager.set(cacheKey, result, 60);
      return result;
    } catch (error) {
      this.logger.error('Failed to fetch Steam data', error);
      return null;
    }
  }
}
