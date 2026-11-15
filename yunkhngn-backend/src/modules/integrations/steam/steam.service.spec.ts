import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import axios from 'axios';
import { SteamService } from './steam.service';
import { SettingsService } from '../../settings/settings.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('SteamService', () => {
  let service: SteamService;
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
        SteamService,
        { provide: ConfigService, useValue: config },
        { provide: SettingsService, useValue: settings },
        { provide: CACHE_MANAGER, useValue: cache },
      ],
    }).compile();
    service = module.get(SteamService);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  it('returns null when both key and user id are missing', async () => {
    expect(await service.getNowPlaying()).toBeNull();
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('returns null when only the API key is missing', async () => {
    settings.getDecryptedSetting
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('76561198000000000');
    expect(await service.getNowPlaying()).toBeNull();
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('returns null when only the user id is missing', async () => {
    settings.getDecryptedSetting
      .mockResolvedValueOnce('steam-key')
      .mockResolvedValueOnce(null);
    expect(await service.getNowPlaying()).toBeNull();
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('returns cached value without hitting the API', async () => {
    cache.get.mockResolvedValue({
      name: 'Cached Game',
      is_playing_now: false,
      playtime_2weeks_minutes: 120,
    });
    const result = await service.getNowPlaying();
    expect(result?.name).toBe('Cached Game');
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('returns active game when player is in-game', async () => {
    settings.getDecryptedSetting
      .mockResolvedValueOnce('steam-key')
      .mockResolvedValueOnce('76561198000000000');
    mockedAxios.get.mockResolvedValue({
      data: {
        response: {
          players: [{ gameextrainfo: 'Counter-Strike 2', gameid: '730' }],
        },
      },
    });
    const result = await service.getNowPlaying();
    expect(result).toEqual({
      name: 'Counter-Strike 2',
      app_id: 730,
      is_playing_now: true,
    });
    expect(cache.set).toHaveBeenCalledWith(
      'steam_now_playing',
      expect.any(Object),
      60,
    );
  });

  it('falls back to recent game when not in-game', async () => {
    settings.getDecryptedSetting
      .mockResolvedValueOnce('steam-key')
      .mockResolvedValueOnce('76561198000000000');
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes('GetPlayerSummaries')) {
        return Promise.resolve({
          data: { response: { players: [{ personaname: 'yunkhngn' }] } },
        });
      }
      return Promise.resolve({
        data: {
          response: {
            games: [
              { name: 'Counter-Strike 2', appid: 730, playtime_2weeks: 200 },
            ],
          },
        },
      });
    });
    const result = await service.getNowPlaying();
    expect(result).toEqual({
      name: 'Counter-Strike 2',
      app_id: 730,
      is_playing_now: false,
      playtime_2weeks_minutes: 200,
    });
  });

  it('returns null when not in-game and no recent games', async () => {
    settings.getDecryptedSetting
      .mockResolvedValueOnce('steam-key')
      .mockResolvedValueOnce('76561198000000000');
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes('GetPlayerSummaries')) {
        return Promise.resolve({
          data: { response: { players: [{ personaname: 'yunkhngn' }] } },
        });
      }
      return Promise.resolve({ data: { response: { games: [] } } });
    });
    expect(await service.getNowPlaying()).toBeNull();
  });

  it('returns null on summaries API error', async () => {
    settings.getDecryptedSetting
      .mockResolvedValueOnce('steam-key')
      .mockResolvedValueOnce('76561198000000000');
    mockedAxios.get.mockRejectedValue(new Error('boom'));
    expect(await service.getNowPlaying()).toBeNull();
  });
});
