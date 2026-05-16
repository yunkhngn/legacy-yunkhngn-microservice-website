import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BlogService } from './blog.service';
import { IBlogRepository } from './domain/blog.repository.interface';
import { NewsletterService } from '../integrations/newsletter/newsletter.service';
import { AiService } from '../ai/ai.service';
import { CloudinaryService } from '../integrations/cloudinary/cloudinary.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { RagSyncQueue } from '../queue/rag-sync/rag-sync.queue';

const mockConfigService = {
  get: jest.fn((key: string) =>
    key === 'app.frontendUrl' ? 'http://localhost:3000' : undefined,
  ),
};

const mockBlogRepository = {
  create: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
  findBySlugOrId: jest.fn(),
  findBySlug: jest.fn(),
  findRelated: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  incrementViews: jest.fn(),
};

const mockNewsletterService = {
  sendToAll: jest.fn(),
};

const mockAiService = {
  syncDocument: jest.fn(),
  findSimilar: jest.fn().mockResolvedValue([]),
};

const mockCloudinaryService = {
  deleteImagesSafely: jest.fn(),
};

const mockAuditLogsService = {
  log: jest.fn(),
};

const mockCacheManager = {
  del: jest.fn(),
};

const mockRagSyncQueue = {
  enqueue: jest.fn(),
};

describe('BlogService', () => {
  let service: BlogService;
  let repository: typeof mockBlogRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlogService,
        { provide: IBlogRepository, useValue: mockBlogRepository },
        { provide: NewsletterService, useValue: mockNewsletterService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: AiService, useValue: mockAiService },
        { provide: CloudinaryService, useValue: mockCloudinaryService },
        { provide: AuditLogsService, useValue: mockAuditLogsService },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
        { provide: RagSyncQueue, useValue: mockRagSyncQueue },
      ],
    }).compile();

    service = module.get<BlogService>(BlogService);
    repository = mockBlogRepository;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a blog', async () => {
      const dto = { title: 'Test', slug: 'test', contentJSON: '{}' };
      const result = {
        id: '1',
        ...dto,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'DRAFT',
        thumbnail: null,
        tags: null,
        seoTitle: null,
        seoDescription: null,
        seoImage: null,
        imageSettings: null,
        views: 0,
      };

      repository.create.mockResolvedValue(result);

      expect(await service.create(dto as any)).toEqual(result);
      expect(repository.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('findAll', () => {
    it('should return an array of blogs', async () => {
      const result = [
        {
          id: '1',
          title: 'Test',
          slug: 'test',
          contentJSON: '{}',
          createdAt: new Date(),
          updatedAt: new Date(),
          status: 'DRAFT',
          thumbnail: null,
          tags: null,
          seoTitle: null,
          seoDescription: null,
          seoImage: null,
          imageSettings: null,
          views: 0,
        },
      ];
      repository.findAll.mockResolvedValue(result);

      expect(await service.findAll()).toEqual(result);
    });
  });

  describe('findOne', () => {
    it('should return a single blog', async () => {
      const blog = {
        id: '1',
        title: 'Test',
        slug: 'test',
        contentJSON: '{}',
        createdAt: new Date(),
        status: 'DRAFT',
        tags: 'tech',
      };

      const relatedPosts = [];
      repository.findBySlugOrId.mockResolvedValue(blog);
      repository.findRelated.mockResolvedValue(relatedPosts);

      const result = await service.findOne('test');
      expect(result.id).toBe(blog.id);
      expect(result.relatedPosts).toEqual(relatedPosts);
    });
  });
});

describe('BlogService - rag-sync enqueue', () => {
  let service: BlogService;
  let blogRepository: any;
  let ragSyncQueue: { enqueue: jest.Mock };
  let aiService: { syncDocument: jest.Mock; findSimilar: jest.Mock };
  let newsletterService: { sendToAll: jest.Mock; sendNewsletter?: jest.Mock };

  beforeEach(async () => {
    blogRepository = {
      findBySlug: jest.fn().mockResolvedValue(null),
      findById: jest.fn().mockResolvedValue({
        id: 'b1',
        status: 'PUBLISHED',
        slug: 's',
        title: 't',
      }),
      create: jest.fn().mockResolvedValue({
        id: 'b1',
        status: 'PUBLISHED',
        slug: 's',
        title: 't',
        contentJSON: '',
        tags: '',
      }),
      update: jest.fn().mockResolvedValue({
        id: 'b1',
        status: 'PUBLISHED',
        slug: 's',
        title: 't',
        contentJSON: '',
        tags: '',
      }),
      delete: jest.fn().mockResolvedValue({
        id: 'b1',
        slug: 's',
        title: 't',
        contentJSON: '',
        thumbnail: null,
        seoImage: null,
      }),
    };
    ragSyncQueue = { enqueue: jest.fn().mockResolvedValue(undefined) };
    aiService = {
      syncDocument: jest.fn().mockResolvedValue(undefined),
      findSimilar: jest.fn().mockResolvedValue([]),
    };
    newsletterService = {
      sendToAll: jest.fn().mockResolvedValue({ sent: 0 }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        BlogService,
        { provide: IBlogRepository, useValue: blogRepository },
        { provide: NewsletterService, useValue: newsletterService },
        { provide: ConfigService, useValue: { get: () => 'http://x' } },
        { provide: AiService, useValue: aiService },
        {
          provide: CloudinaryService,
          useValue: { deleteImagesSafely: jest.fn() },
        },
        { provide: AuditLogsService, useValue: { log: jest.fn() } },
        { provide: CACHE_MANAGER, useValue: { del: jest.fn() } },
        { provide: RagSyncQueue, useValue: ragSyncQueue },
      ],
    }).compile();

    service = moduleRef.get(BlogService);
  });

  it('enqueues an upsert when a PUBLISHED blog is created', async () => {
    await service.create({ slug: 's', title: 't', status: 'PUBLISHED' } as any);
    expect(ragSyncQueue.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ op: 'upsert', type: 'blog', docId: 'b1' }),
    );
    expect(aiService.syncDocument).not.toHaveBeenCalled();
  });

  it('enqueues an upsert when a blog update keeps it PUBLISHED', async () => {
    await service.update('b1', { title: 't2' } as any);
    expect(ragSyncQueue.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ op: 'upsert', type: 'blog', docId: 'b1' }),
    );
  });

  it('enqueues a delete when a blog is removed', async () => {
    await service.remove('b1');
    expect(ragSyncQueue.enqueue).toHaveBeenCalledWith({
      op: 'delete',
      type: 'blog',
      docId: 'b1',
    });
  });
});
