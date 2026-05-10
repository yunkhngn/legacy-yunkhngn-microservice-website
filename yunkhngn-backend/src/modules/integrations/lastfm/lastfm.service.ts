import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SettingsService } from '../../settings/settings.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import axios from 'axios';

@Injectable()
export class LastFmService implements OnModuleInit {
  private readonly logger = new Logger(LastFmService.name);
  private readonly baseUrl = 'https://ws.audioscrobbler.com/2.0/';

  constructor(
    private configService: ConfigService,
    private settingsService: SettingsService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async onModuleInit() {
    // Check if keys exist
    const key = await this.getApiKey();
    const user = await this.getUsername();
    if (!key || !user) {
      this.logger.warn('Last.fm configuration missing. Widget will not work.');
    }
  }

  private async getApiKey() {
    return (
      (await this.settingsService.getDecryptedSetting('lastfm_api_key')) ||
      this.configService.get<string>('LASTFM_API_KEY')
    );
  }

  private async getUsername() {
    return (
      (await this.settingsService.getDecryptedSetting('lastfm_username')) ||
      this.configService.get<string>('LASTFM_USERNAME')
    );
  }

  async getRecentTrack() {
    const cacheKey = 'lastfm_recent_track';
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const apiKey = await this.getApiKey();
    const username = await this.getUsername();

    if (!apiKey || !username) return null;

    try {
      const { data } = await axios.get(this.baseUrl, {
        params: {
          method: 'user.getrecenttracks',
          user: username,
          api_key: apiKey,
          format: 'json',
          limit: 1,
        },
      });

      const track = data?.recenttracks?.track?.[0];
      if (!track) return null;

      const result = {
        name: track.name,
        artist: track.artist['#text'],
        album: track.album['#text'],
        art:
          track.image?.find((i) => i.size === 'medium')?.['#text'] ||
          track.image?.find((i) => i.size === 'small')?.['#text'],
        url: track.url,
        isNowPlaying: !!track['@attr']?.nowplaying,
      };

      // Cache for 30 seconds
      await this.cacheManager.set(cacheKey, result, 30);

      return result;
    } catch (error) {
      this.logger.error('Failed to fetch Last.fm data', error);
      return null;
    }
  }
}
