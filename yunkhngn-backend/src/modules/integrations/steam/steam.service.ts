import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SettingsService } from '../../settings/settings.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import axios from 'axios';

export interface SteamNowPlaying {
  name: string;
  app_id?: number;
  is_playing_now: boolean;
  playtime_2weeks_minutes?: number;
}

const CACHE_TTL_SECONDS = 60;

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
      // 1) Check if currently in-game
      const summariesRes = await axios.get(
        `${this.baseUrl}/ISteamUser/GetPlayerSummaries/v2/`,
        { params: { key: apiKey, steamids: userId } },
      );
      const player = summariesRes.data?.response?.players?.[0];
      const gameName: string | undefined = player?.gameextrainfo;
      const gameId: string | undefined = player?.gameid;

      if (gameName) {
        const result: SteamNowPlaying = {
          name: gameName,
          app_id: gameId ? Number(gameId) : undefined,
          is_playing_now: true,
        };
        // TTL in seconds
        await this.cacheManager.set(cacheKey, result, CACHE_TTL_SECONDS);
        return result;
      }

      // 2) Not in-game — fall back to recent game
      const recentRes = await axios.get(
        `${this.baseUrl}/IPlayerService/GetRecentlyPlayedGames/v1/`,
        { params: { key: apiKey, steamid: userId, count: 1 } },
      );
      const recent = recentRes.data?.response?.games?.[0];
      if (!recent?.name) return null;

      const result: SteamNowPlaying = {
        name: recent.name,
        app_id: recent.appid ? Number(recent.appid) : undefined,
        is_playing_now: false,
        playtime_2weeks_minutes: recent.playtime_2weeks ?? 0,
      };
      // TTL in seconds
      await this.cacheManager.set(cacheKey, result, CACHE_TTL_SECONDS);
      return result;
    } catch (error) {
      this.logger.error('Failed to fetch Steam data', error);
      return null;
    }
  }
}
