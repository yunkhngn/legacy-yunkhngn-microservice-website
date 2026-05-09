import { Test, TestingModule } from '@nestjs/testing';
import { VercelService } from './vercel.service';
import { SettingsService } from '../../settings/settings.service';

describe('VercelService', () => {
  let service: VercelService;
  let settingsService: any;

  const mockSettingsService = {
    getDecryptedSetting: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VercelService,
        { provide: SettingsService, useValue: mockSettingsService },
      ],
    }).compile();

    service = module.get<VercelService>(VercelService);
    settingsService = module.get<SettingsService>(SettingsService);

    // Mock global fetch
    global.fetch = jest.fn();
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAnalytics', () => {
    it('should return null if credentials are not configured', async () => {
      settingsService.getDecryptedSetting.mockResolvedValue(null);
      const result = await service.getAnalytics();
      expect(result).toBeNull();
    });

    it('should fetch analytics data correctly', async () => {
      settingsService.getDecryptedSetting
        .mockResolvedValueOnce('token')
        .mockResolvedValueOnce('project-id')
        .mockResolvedValueOnce('team-id');

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ visitors: 100 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: [] }),
        });

      const result = await service.getAnalytics();

      expect(result).toEqual({
        stats: { visitors: 100 },
        timeseries: { data: [] },
      });
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should throw error if fetch fails', async () => {
      settingsService.getDecryptedSetting.mockResolvedValue('value');
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(service.getAnalytics()).rejects.toThrow('Vercel API error');
    });
  });

  describe('getSpeedInsights', () => {
    it('should fetch speed insights correctly', async () => {
      settingsService.getDecryptedSetting
        .mockResolvedValueOnce('token')
        .mockResolvedValueOnce('project-id')
        .mockResolvedValueOnce(null);

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ score: 90 }),
      });

      const result = await service.getSpeedInsights();

      expect(result).toEqual({ score: 90 });
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('speed-insights'),
        expect.any(Object),
      );
    });
  });
});
