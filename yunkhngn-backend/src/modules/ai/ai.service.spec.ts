import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from './ai.service';
import { ConfigService } from '@nestjs/config';
import { SettingsService } from '../settings/settings.service';

describe('AiService', () => {
  let service: AiService;
  const originalFetch = global.fetch;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'GEMINI_API_KEY') return 'fake-api-key';
      if (key === 'LETTER_AI_URL') return 'http://ai-service:8000';
      return null;
    }),
  };

  const mockSettingsService = {
    getDecryptedSetting: jest.fn().mockResolvedValue(null),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: SettingsService, useValue: mockSettingsService },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ text: 'mock response', content: 'mock content' }),
    } as unknown as Response);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should call callAiService correctly in generateText', async () => {
    await service.generateText('hello');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/gemini/generate'),
      expect.any(Object)
    );
  });
});
