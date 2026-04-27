import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from './ai.service';
import { ConfigService } from '@nestjs/config';
import { SettingsService } from '../settings/settings.service';
import { IBlogRepository } from '../blog/domain/blog.repository.interface';
import { IProjectRepository } from '../project/domain/project.repository.interface';
import { IGalleryRepository } from '../gallery/domain/gallery.repository.interface';

describe('AiService', () => {
  let service: AiService;
  const originalFetch = global.fetch;
  let getModelSpy: jest.SpyInstance;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'GEMINI_API_KEY') return 'fake-api-key';
      return null;
    }),
  };

  const mockSettingsService = {
    getDecryptedSetting: jest.fn().mockResolvedValue(null),
  };

  const mockBlogRepository = { findAll: jest.fn() };
  const mockProjectRepository = { findAll: jest.fn() };
  const mockGalleryRepository = { findAll: jest.fn() };

  const mockModel = {
    generateContent: jest.fn().mockResolvedValue({
      response: {
        text: () =>
          JSON.stringify({
            title: 'Generated title',
            description: 'Generated description',
            content: '<p>Generated content</p>',
            techStack: ['Next.js'],
            tags: ['Web'],
            demoLink: '',
          }),
      },
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: SettingsService, useValue: mockSettingsService },
        { provide: IBlogRepository, useValue: mockBlogRepository },
        { provide: IProjectRepository, useValue: mockProjectRepository },
        { provide: IGalleryRepository, useValue: mockGalleryRepository },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
    getModelSpy = jest
      .spyOn(service as any, 'getModel')
      .mockResolvedValue(mockModel);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: () => '# README',
    } as unknown as Response);
  });

  afterEach(() => {
    getModelSpy?.mockRestore();
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('uses normalized repo name for .git clone URL', async () => {
    await service.generateProjectInfo('https://github.com/vercel/next.js.git');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/vercel/next.js/readme',
      expect.objectContaining({
        headers: { Accept: 'application/vnd.github.raw' },
      }),
    );
  });
});
