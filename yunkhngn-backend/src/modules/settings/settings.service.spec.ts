import { Test, TestingModule } from '@nestjs/testing';
import { SettingsService } from './settings.service';
import { ISettingsRepository } from './domain/settings.repository.interface';
import { EncryptionService } from '../../common/encryption.service';

const mockSettingsRepository = {
  upsert: jest.fn(),
  findAll: jest.fn(),
  findByTitle: jest.fn(),
  findById: jest.fn(),
  findByTitles: jest.fn(),
  delete: jest.fn(),
};

const mockEncryptionService = {
  encrypt: jest.fn((val) => val),
  decrypt: jest.fn((val) => val),
};

describe('SettingsService', () => {
  let service: SettingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: ISettingsRepository, useValue: mockSettingsRepository },
        { provide: EncryptionService, useValue: mockEncryptionService },
      ],
    }).compile();

    service = module.get<SettingsService>(SettingsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSettings', () => {
    it('should return public settings', async () => {
      const result = [{ id: 1, settingTitle: 'bio', content: 'test' }];
      mockSettingsRepository.findByTitles.mockResolvedValue(result);

      expect(await service.getSettings()).toEqual(result);
      expect(mockSettingsRepository.findByTitles).toHaveBeenCalled();
    });
  });

  describe('onModuleInit', () => {
    it('should initialize default settings', async () => {
      await service.onModuleInit();
      expect(mockSettingsRepository.upsert).toHaveBeenCalled();
    });
  });
});
