import { Test, TestingModule } from '@nestjs/testing';
import { ProjectService } from './project.service';
import { IProjectRepository } from './domain/project.repository.interface';
import { CreateProjectDto } from './dto/create-project.dto';
import { AiService } from '../ai/ai.service';
import { CloudinaryService } from '../integrations/cloudinary/cloudinary.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { RagSyncQueue } from '../queue/rag-sync/rag-sync.queue';

const mockProjectRepository = {
  create: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
  findBySlug: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  findRelated: jest.fn(),
};

const mockAiService = {
  syncDocument: jest.fn(),
  findSimilar: jest.fn(),
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

describe('ProjectService', () => {
  let service: ProjectService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectService,
        { provide: IProjectRepository, useValue: mockProjectRepository },
        { provide: AiService, useValue: mockAiService },
        { provide: CloudinaryService, useValue: mockCloudinaryService },
        { provide: AuditLogsService, useValue: mockAuditLogsService },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
        { provide: RagSyncQueue, useValue: mockRagSyncQueue },
      ],
    }).compile();

    service = module.get<ProjectService>(ProjectService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a project', async () => {
      const dto: CreateProjectDto = {
        title: 'Test Project',
        description: 'Test Description',
        slug: 'test-project',
        contentJSON: '{}',
      };
      const result = {
        id: '1',
        ...dto,
        createdAt: new Date(),
        techStack: null,
        tags: null,
        cover: null,
        repoLink: null,
        demoLink: null,
        contentJSON: null,
        seoTitle: null,
        seoDescription: null,
        seoImage: null,
      };

      mockProjectRepository.findBySlug.mockResolvedValue(null);
      mockProjectRepository.create.mockResolvedValue(result);
      mockRagSyncQueue.enqueue.mockResolvedValue(undefined);
      mockAuditLogsService.log.mockResolvedValue(undefined);
      mockCacheManager.del.mockResolvedValue(undefined);

      expect(await service.create(dto)).toEqual(result);
      expect(mockProjectRepository.findBySlug).toHaveBeenCalledWith(dto.slug);
      expect(mockProjectRepository.create).toHaveBeenCalledWith(dto);
    });
  });
});

describe('ProjectService - rag-sync enqueue', () => {
  let service: ProjectService;
  let projectRepository: any;
  let ragSyncQueue: { enqueue: jest.Mock };
  let aiService: { syncDocument: jest.Mock; findSimilar: jest.Mock };

  beforeEach(async () => {
    projectRepository = {
      findBySlug: jest.fn().mockResolvedValue(null),
      findById: jest.fn().mockResolvedValue({
        id: 'p1',
        slug: 's',
        title: 't',
      }),
      create: jest.fn().mockResolvedValue({
        id: 'p1',
        slug: 's',
        title: 't',
        contentJSON: '',
        description: '',
        techStack: '',
      }),
      update: jest.fn().mockResolvedValue({
        id: 'p1',
        slug: 's',
        title: 't',
        contentJSON: '',
        description: '',
        techStack: '',
      }),
      delete: jest.fn().mockResolvedValue({
        id: 'p1',
        slug: 's',
        title: 't',
        contentJSON: '',
        cover: null,
        seoImage: null,
      }),
    };
    ragSyncQueue = { enqueue: jest.fn().mockResolvedValue(undefined) };
    aiService = {
      syncDocument: jest.fn().mockResolvedValue(undefined),
      findSimilar: jest.fn().mockResolvedValue([]),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ProjectService,
        { provide: IProjectRepository, useValue: projectRepository },
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

    service = moduleRef.get(ProjectService);
  });

  it('enqueues upsert on create', async () => {
    await service.create({ slug: 's', title: 't' } as any);
    expect(ragSyncQueue.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ op: 'upsert', type: 'project', docId: 'p1' }),
    );
    expect(aiService.syncDocument).not.toHaveBeenCalled();
  });

  it('enqueues upsert on update', async () => {
    await service.update('p1', { title: 't2' } as any);
    expect(ragSyncQueue.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ op: 'upsert', type: 'project', docId: 'p1' }),
    );
  });

  it('enqueues delete on remove', async () => {
    await service.remove('p1');
    expect(ragSyncQueue.enqueue).toHaveBeenCalledWith({
      op: 'delete',
      type: 'project',
      docId: 'p1',
    });
  });
});
