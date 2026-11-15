import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import axios from 'axios';
import { WeatherService } from './weather.service';
import { SettingsService } from '../../settings/settings.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('WeatherService', () => {
  let service: WeatherService;
  const cache = { get: jest.fn(), set: jest.fn() };
  const settings = { getDecryptedSetting: jest.fn() };
  const config = { get: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    cache.get.mockResolvedValue(undefined);
    settings.getDecryptedSetting.mockResolvedValue(null);
    config.get.mockReturnValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WeatherService,
        { provide: ConfigService, useValue: config },
        { provide: SettingsService, useValue: settings },
        { provide: CACHE_MANAGER, useValue: cache },
      ],
    }).compile();
    service = module.get(WeatherService);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  it('returns null when API key is missing', async () => {
    expect(await service.getHanoi()).toBeNull();
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('returns cached value without hitting the API', async () => {
    cache.get.mockResolvedValue({ temp: 25, condition: 'Clear', description: 'cached' });
    const result = await service.getHanoi();
    expect(result).toEqual({ temp: 25, condition: 'Clear', description: 'cached' });
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('returns parsed data on happy path', async () => {
    settings.getDecryptedSetting.mockResolvedValue('owm-key');
    mockedAxios.get.mockResolvedValue({
      data: {
        main: { temp: 28.4 },
        weather: [{ main: 'Clear', description: 'clear sky' }],
      },
    });
    const result = await service.getHanoi();
    expect(result).toEqual({ temp: 28, condition: 'Clear', description: 'clear sky' });
    expect(cache.set).toHaveBeenCalledWith('weather_hanoi', expect.any(Object), 600);
  });

  it('returns null on API error', async () => {
    settings.getDecryptedSetting.mockResolvedValue('owm-key');
    mockedAxios.get.mockRejectedValue(new Error('boom'));
    expect(await service.getHanoi()).toBeNull();
  });
});
