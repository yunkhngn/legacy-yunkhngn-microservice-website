import { Test, TestingModule } from '@nestjs/testing';
import { SettingsService } from './settings.service';
import { ISettingsRepository } from './domain/settings.repository.interface';
import { EncryptionService } from '../../common/encryption.service';
import { AiService } from '../ai/ai.service';
import { BadRequestException } from '@nestjs/common';

describe('SettingsService', () => {
  let service: SettingsService;
  let repo: any;
  let encryption: any;
  let ai: any;

  const mockSettingsRepository = {
    upsert: jest.fn(),
    findAll: jest.fn(),
    findByTitle: jest.fn(),
    findById: jest.fn(),
    findByTitles: jest.fn(),
    delete: jest.fn(),
    create: jest.fn(),
    updateGroup: jest.fn(),
  };

  const mockEncryptionService = {
    encrypt: jest.fn((val) => `enc_${val}`),
    decrypt: jest.fn((val) => val.replace('enc_', '')),
  };

  const mockAiService = {
    syncDocument: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: ISettingsRepository, useValue: mockSettingsRepository },
        { provide: EncryptionService, useValue: mockEncryptionService },
        { provide: AiService, useValue: mockAiService },
      ],
    }).compile();

    service = module.get<SettingsService>(SettingsService);
    repo = module.get(ISettingsRepository);
    encryption = module.get(EncryptionService);
    ai = module.get(AiService);

    jest.clearAllMocks();
  });

  describe('getGroupedSettings', () => {
    it('should return settings grouped by group name with sensitive values masked', async () => {
      const mockData = [
        {
          id: 1,
          settingTitle: 'bio',
          content: 'hello',
          group: 'General',
          sortOrder: 1,
        },
        {
          id: 2,
          settingTitle: 'vercel_api_token',
          content: 'secret',
          group: 'Vercel',
          sortOrder: 1,
        },
      ];
      repo.findAll.mockResolvedValue(mockData);

      const result = await service.getGroupedSettings();

      expect(result).toHaveLength(2);
      expect(result[0].group).toBe('General');
      expect(result[1].group).toBe('Vercel');
      expect(result[1].settings[0].content).toBe('********');
    });
  });

  describe('create', () => {
    it('should create a new setting', async () => {
      repo.findByTitle.mockResolvedValue(null);
      repo.create.mockResolvedValue({
        id: 4,
        settingTitle: 'new_key',
        content: 'val',
        group: 'Test',
      });

      const result = await service.create('new_key', 'val', 'Test');

      expect(result.settingTitle).toBe('new_key');
      expect(repo.create).toHaveBeenCalledWith('new_key', 'val', 'Test', 0);
    });

    it('should throw if setting already exists', async () => {
      repo.findByTitle.mockResolvedValue({ id: 1 });

      await expect(service.create('bio', 'new bio')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('update', () => {
    it('should encrypt sensitive keys and sync to AI', async () => {
      const dto = { settingTitle: 'bio', content: 'new bio' };
      repo.findByTitle.mockResolvedValue({
        id: 1,
        group: 'General',
        sortOrder: 5,
      });
      repo.upsert.mockResolvedValue({ ...dto, group: 'General', sortOrder: 5 });

      await service.update(dto);

      expect(repo.upsert).toHaveBeenCalledWith('bio', 'new bio', 'General', 5);
      expect(ai.syncDocument).toHaveBeenCalledWith(
        'setting',
        'bio',
        'new bio',
        expect.any(Object),
      );
    });

    it('should mask sensitive keys correctly', async () => {
      const dto = { settingTitle: 'vercel_api_token', content: 'my-token' };
      repo.findByTitle.mockResolvedValue({
        id: 2,
        group: 'Vercel',
        sortOrder: 10,
      });
      repo.upsert.mockResolvedValue({ ...dto, group: 'Vercel', sortOrder: 10 });

      await service.update(dto);

      expect(encryption.encrypt).toHaveBeenCalledWith('my-token');
      expect(repo.upsert).toHaveBeenCalledWith(
        'vercel_api_token',
        'enc_my-token',
        'Vercel',
        10,
      );
    });
  });

  describe('delete', () => {
    it('should delete a setting', async () => {
      repo.delete.mockResolvedValue({ id: 1 });
      const result = await service.delete(1);
      expect(result.id).toBe(1);
      expect(repo.delete).toHaveBeenCalledWith(1);
    });
  });
});
