import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import axios from 'axios';
import { WakaTimeService } from './wakatime.service';
import { SettingsService } from '../../settings/settings.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('WakaTimeService', () => {
  let service: WakaTimeService;
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
        WakaTimeService,
        { provide: ConfigService, useValue: config },
        { provide: SettingsService, useValue: settings },
        { provide: CACHE_MANAGER, useValue: cache },
      ],
    }).compile();
    service = module.get(WakaTimeService);

    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  it('returns null when API key is missing', async () => {
    expect(await service.getToday()).toBeNull();
  });

  it('returns null on zero coding seconds', async () => {
    settings.getDecryptedSetting.mockResolvedValue('test-key');
    mockedAxios.get.mockResolvedValue({
      data: {
        data: [{ grand_total: { total_seconds: 0, text: '0 secs' }, languages: [] }],
      },
    });
    expect(await service.getToday()).toBeNull();
  });

  it('returns formatted data on happy path', async () => {
    settings.getDecryptedSetting.mockResolvedValue('test-key');
    mockedAxios.get.mockResolvedValue({
      data: {
        data: [
          {
            grand_total: { total_seconds: 16320, text: '4 hrs 32 mins' },
            languages: [{ name: 'TypeScript' }, { name: 'JSON' }],
          },
        ],
      },
    });
    const result = await service.getToday();
    expect(result).toEqual({
      text: '4 hrs 32 mins',
      total_seconds: 16320,
      top_language: 'TypeScript',
    });
    expect(cache.set).toHaveBeenCalledWith('wakatime_today', expect.any(Object), 300);
  });

  it('returns null on API error', async () => {
    settings.getDecryptedSetting.mockResolvedValue('test-key');
    mockedAxios.get.mockRejectedValue(new Error('boom'));
    expect(await service.getToday()).toBeNull();
  });
});
