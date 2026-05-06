import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BlogService } from './blog.service';
import { IBlogRepository } from './domain/blog.repository.interface';
import { NewsletterService } from '../integrations/newsletter/newsletter.service';
import { AiService } from '../ai/ai.service';
import { CloudinaryService } from '../integrations/cloudinary/cloudinary.service';

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
};

const mockCloudinaryService = {
  deleteImagesSafely: jest.fn(),
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
