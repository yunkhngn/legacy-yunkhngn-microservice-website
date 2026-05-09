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

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getGroupedSettings', () => {
    it('should return settings grouped by group name with sensitive values masked', async () => {
      const mockData = [
        { id: 1, settingTitle: 'bio', content: 'hello', group: 'General', sortOrder: 1, isSensitive: false },
        { id: 2, settingTitle: 'vercel_api_token', content: 'secret', group: 'Vercel', sortOrder: 1, isSensitive: true },
      ];
      repo.findAll.mockResolvedValue(mockData);

      const result = await service.getGroupedSettings();

      expect(result).toHaveLength(2);
      expect(result[0].group).toBe('General');
      expect(result[0].settings[0].content).toBe('hello');
      expect(result[1].group).toBe('Vercel');
      expect(result[1].settings[0].content).toBe('********');
    });

    it('should NOT mask non-sensitive settings even if they look like keys', async () => {
      const mockData = [
        { id: 1, settingTitle: 'some_api_key', content: 'visible', group: 'Custom', sortOrder: 1, isSensitive: false },
      ];
      repo.findAll.mockResolvedValue(mockData);

      const result = await service.getGroupedSettings();
      expect(result[0].settings[0].content).toBe('visible');
    });
  });

  describe('create', () => {
    it('should create a new non-sensitive setting', async () => {
      repo.findByTitle.mockResolvedValue(null);
      repo.create.mockResolvedValue({ id: 4, settingTitle: 'new_key', content: 'val', group: 'Test', isSensitive: false });

      const result = await service.create('new_key', 'val', 'Test', false);

      expect(result.settingTitle).toBe('new_key');
      expect(repo.create).toHaveBeenCalledWith('new_key', 'val', 'Test', 0, false);
    });

    it('should encrypt content when creating a sensitive setting', async () => {
      repo.findByTitle.mockResolvedValue(null);
      repo.create.mockResolvedValue({ id: 5, settingTitle: 'my_secret', content: 'enc_token', group: 'Secrets', isSensitive: true });

      await service.create('my_secret', 'token', 'Secrets', true);

      expect(encryption.encrypt).toHaveBeenCalledWith('token');
      expect(repo.create).toHaveBeenCalledWith('my_secret', 'enc_token', 'Secrets', 0, true);
    });

    it('should throw if setting already exists', async () => {
      repo.findByTitle.mockResolvedValue({ id: 1 });

      await expect(service.create('bio', 'new bio')).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('should update a non-sensitive setting and sync to AI', async () => {
      const dto = { settingTitle: 'bio', content: 'new bio' };
      repo.findByTitle.mockResolvedValue({ id: 1, group: 'General', sortOrder: 5, isSensitive: false });
      repo.upsert.mockResolvedValue({ ...dto, group: 'General', sortOrder: 5, isSensitive: false });

      await service.update(dto);

      expect(repo.upsert).toHaveBeenCalledWith('bio', 'new bio', 'General', 5, false);
      expect(ai.syncDocument).toHaveBeenCalledWith('setting', 'bio', 'new bio', expect.any(Object));
    });

    it('should encrypt content for sensitive keys', async () => {
      const dto = { settingTitle: 'vercel_api_token', content: 'my-token' };
      repo.findByTitle.mockResolvedValue({ id: 2, group: 'Vercel', sortOrder: 10, isSensitive: true });
      repo.upsert.mockResolvedValue({ ...dto, group: 'Vercel', sortOrder: 10, isSensitive: true });

      await service.update(dto);

      expect(encryption.encrypt).toHaveBeenCalledWith('my-token');
      expect(repo.upsert).toHaveBeenCalledWith('vercel_api_token', 'enc_my-token', 'Vercel', 10, true);
    });

    it('should skip content update when masked value is sent for sensitive key', async () => {
      const dto = { settingTitle: 'vercel_api_token', content: '********' };
      repo.findByTitle.mockResolvedValue({ id: 2, content: 'enc_existing', group: 'Vercel', sortOrder: 10, isSensitive: true });
      repo.upsert.mockResolvedValue({ id: 2, settingTitle: 'vercel_api_token', content: 'enc_existing', group: 'Vercel', sortOrder: 10, isSensitive: true });

      await service.update(dto);

      // Should preserve original encrypted content, not encrypt the mask
      expect(encryption.encrypt).not.toHaveBeenCalled();
      expect(repo.upsert).toHaveBeenCalledWith('vercel_api_token', 'enc_existing', 'Vercel', 10, true);
    });

    it('should allow toggling isSensitive via update', async () => {
      const dto = { settingTitle: 'some_key', content: 'value', isSensitive: true };
      repo.findByTitle.mockResolvedValue({ id: 3, group: 'Custom', sortOrder: 0, isSensitive: false });
      repo.upsert.mockResolvedValue({ ...dto, group: 'Custom', sortOrder: 0 });

      await service.update(dto);

      // Now sensitive, so content should be encrypted
      expect(encryption.encrypt).toHaveBeenCalledWith('value');
      expect(repo.upsert).toHaveBeenCalledWith('some_key', 'enc_value', 'Custom', 0, true);
    });
  });

  describe('delete', () => {
    it('should delete a non-system setting', async () => {
      repo.findById.mockResolvedValue({ id: 99, settingTitle: 'custom_key' });
      repo.delete.mockResolvedValue({ id: 99 });
      const result = await service.delete(99);
      expect(result.id).toBe(99);
      expect(repo.delete).toHaveBeenCalledWith(99);
    });

    it('should throw when deleting a system setting', async () => {
      repo.findById.mockResolvedValue({ id: 1, settingTitle: 'bio' });
      await expect(service.delete(1)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getDecryptedSetting', () => {
    it('should decrypt sensitive settings', async () => {
      repo.findByTitle.mockResolvedValue({ content: 'enc_secret', isSensitive: true });
      const result = await service.getDecryptedSetting('vercel_api_token');
      expect(result).toBe('secret');
      expect(encryption.decrypt).toHaveBeenCalledWith('enc_secret');
    });

    it('should return plain content for non-sensitive settings', async () => {
      repo.findByTitle.mockResolvedValue({ content: 'hello', isSensitive: false });
      const result = await service.getDecryptedSetting('bio');
      expect(result).toBe('hello');
      expect(encryption.decrypt).not.toHaveBeenCalled();
    });
  });
});
