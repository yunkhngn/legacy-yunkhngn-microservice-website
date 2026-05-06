import { Test, TestingModule } from '@nestjs/testing';
import { ProjectService } from './project.service';
import { IProjectRepository } from './domain/project.repository.interface';
import { CreateProjectDto } from './dto/create-project.dto';
import { AiService } from '../ai/ai.service';
import { CloudinaryService } from '../integrations/cloudinary/cloudinary.service';

const mockProjectRepository = {
  create: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
  findBySlug: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

const mockAiService = {
  syncDocument: jest.fn(),
};

const mockCloudinaryService = {
  deleteImagesSafely: jest.fn(),
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

      expect(await service.create(dto)).toEqual(result);
      expect(mockProjectRepository.findBySlug).toHaveBeenCalledWith(dto.slug);
      expect(mockProjectRepository.create).toHaveBeenCalledWith(dto);
    });
  });
});
