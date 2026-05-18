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
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('returns cached value without hitting the API', async () => {
    cache.get.mockResolvedValue({
      text: '1 hr',
      total_seconds: 3600,
      top_language: 'Go',
      is_coding_now: true,
      last_heartbeat_at: '2026-05-17T12:00:00.000Z',
    });
    const result = await service.getToday();
    expect(result?.top_language).toBe('Go');
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('returns null on zero coding seconds', async () => {
    settings.getDecryptedSetting.mockResolvedValue('test-key');
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes('summaries')) {
        return Promise.resolve({
          data: {
            data: [
              {
                grand_total: { total_seconds: 0, text: '0 secs' },
                languages: [],
              },
            ],
          },
        });
      }
      return Promise.resolve({ data: { data: [] } });
    });
    expect(await service.getToday()).toBeNull();
  });

  it('returns active state when last heartbeat is recent', async () => {
    settings.getDecryptedSetting.mockResolvedValue('test-key');
    const nowSec = Date.now() / 1000;
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes('summaries')) {
        return Promise.resolve({
          data: {
            data: [
              {
                grand_total: { total_seconds: 16320, text: '4 hrs 32 mins' },
                languages: [{ name: 'TypeScript' }, { name: 'JSON' }],
              },
            ],
          },
        });
      }
      return Promise.resolve({
        data: { data: [{ time: nowSec - 60 }] },
      });
    });
    const result = await service.getToday();
    expect(result).toMatchObject({
      text: '4 hrs 32 mins',
      total_seconds: 16320,
      top_language: 'TypeScript',
      is_coding_now: true,
    });
    expect(result?.last_heartbeat_at).toBeTruthy();
    expect(cache.set).toHaveBeenCalledWith(
      'wakatime_today',
      expect.any(Object),
      60,
    );
  });

  it('returns inactive state when last heartbeat is stale', async () => {
    settings.getDecryptedSetting.mockResolvedValue('test-key');
    const nowSec = Date.now() / 1000;
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes('summaries')) {
        return Promise.resolve({
          data: {
            data: [
              {
                grand_total: { total_seconds: 16320, text: '4 hrs 32 mins' },
                languages: [{ name: 'TypeScript' }],
              },
            ],
          },
        });
      }
      return Promise.resolve({
        data: { data: [{ time: nowSec - 30 * 60 }] },
      });
    });
    const result = await service.getToday();
    expect(result?.is_coding_now).toBe(false);
    expect(result?.last_heartbeat_at).toBeTruthy();
  });

  it('falls back to inactive when heartbeats endpoint fails', async () => {
    settings.getDecryptedSetting.mockResolvedValue('test-key');
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes('summaries')) {
        return Promise.resolve({
          data: {
            data: [
              {
                grand_total: { total_seconds: 16320, text: '4 hrs 32 mins' },
                languages: [{ name: 'TypeScript' }],
              },
            ],
          },
        });
      }
      return Promise.reject(new Error('401 unauthorized'));
    });
    const result = await service.getToday();
    expect(result?.is_coding_now).toBe(false);
    expect(result?.last_heartbeat_at).toBeNull();
  });

  it('returns null on summaries API error', async () => {
    settings.getDecryptedSetting.mockResolvedValue('test-key');
    mockedAxios.get.mockRejectedValue(new Error('boom'));
    expect(await service.getToday()).toBeNull();
  });
});
