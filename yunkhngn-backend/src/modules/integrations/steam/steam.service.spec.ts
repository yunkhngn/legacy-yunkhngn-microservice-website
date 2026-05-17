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
    // Settings: first lookup (api key) → null, second lookup (user id) → present
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

  it('returns game name when player is in-game', async () => {
    settings.getDecryptedSetting
      .mockResolvedValueOnce('steam-key')
      .mockResolvedValueOnce('76561198000000000');
    mockedAxios.get.mockResolvedValue({
      data: {
        response: {
          players: [
            { gameextrainfo: 'Counter-Strike 2', gameid: '730' },
          ],
        },
      },
    });
    const result = await service.getNowPlaying();
    expect(result).toEqual({ name: 'Counter-Strike 2', app_id: 730 });
    expect(cache.set).toHaveBeenCalledWith('steam_now_playing', expect.any(Object), 60);
  });

  it('returns null when player is not in-game', async () => {
    settings.getDecryptedSetting
      .mockResolvedValueOnce('steam-key')
      .mockResolvedValueOnce('76561198000000000');
    mockedAxios.get.mockResolvedValue({
      data: { response: { players: [{ personaname: 'yunkhngn' }] } },
    });
    expect(await service.getNowPlaying()).toBeNull();
  });

  it('returns null on API error', async () => {
    settings.getDecryptedSetting
      .mockResolvedValueOnce('steam-key')
      .mockResolvedValueOnce('76561198000000000');
    mockedAxios.get.mockRejectedValue(new Error('boom'));
    expect(await service.getNowPlaying()).toBeNull();
  });
});
