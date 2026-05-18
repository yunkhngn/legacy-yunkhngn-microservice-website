import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SettingsService } from '../../settings/settings.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import axios from 'axios';

export interface HanoiWeather {
  temp: number;
  condition: string;
  description: string;
}

const CACHE_TTL_SECONDS = 600;

@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);
  private readonly url = 'https://api.openweathermap.org/data/2.5/weather';

  constructor(
    private configService: ConfigService,
    private settingsService: SettingsService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  private async getApiKey(): Promise<string | null> {
    return (
      (await this.settingsService.getDecryptedSetting('openweather_api_key')) ||
      this.configService.get<string>('OPENWEATHER_API_KEY') ||
      null
    );
  }

  async getHanoi(): Promise<HanoiWeather | null> {
    const cacheKey = 'weather_hanoi';
    const cached = await this.cacheManager.get<HanoiWeather>(cacheKey);
    if (cached) return cached;

    const apiKey = await this.getApiKey();
    if (!apiKey) {
      this.logger.warn('OpenWeather API key not configured');
      return null;
    }

    try {
      const { data } = await axios.get(this.url, {
        params: { q: 'Hanoi,VN', appid: apiKey, units: 'metric' },
      });

      const result: HanoiWeather = {
        temp: Math.round(data?.main?.temp ?? 0),
        condition: data?.weather?.[0]?.main ?? 'Unknown',
        description: data?.weather?.[0]?.description ?? '',
      };

      // TTL in seconds
      await this.cacheManager.set(cacheKey, result, CACHE_TTL_SECONDS);
      return result;
    } catch (error) {
      this.logger.error('Failed to fetch weather data', error);
      return null;
    }
  }
}
