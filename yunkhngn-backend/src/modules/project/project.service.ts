import { Injectable, ConflictException, Inject, Logger } from '@nestjs/common';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { IProjectRepository } from './domain/project.repository.interface';
import { Project } from './domain/project.entity';
import { AiService } from '../ai/ai.service';

@Injectable()
export class ProjectService {
  private readonly logger = new Logger(ProjectService.name);

  constructor(
    @Inject(IProjectRepository)
    private readonly projectRepository: IProjectRepository,
    private readonly aiService: AiService,
  ) {}

  private mapDtoToEntityData(dto: CreateProjectDto | UpdateProjectDto) {
    const data = { ...dto } as any;
    if (data.link) {
      data.demoLink = data.link;
      delete data.link;
    }
    if (data.images) {
      try {
        const parsed = JSON.parse(data.images);
        if (Array.isArray(parsed) && parsed.length > 0) {
          data.cover = parsed[0];
        }
      } catch {
        // ignore invalid json
      }
      delete data.images;
    }
    delete data.id;
    delete data.createdAt;
    return data;
  }

  async create(createProjectDto: CreateProjectDto): Promise<Project> {
    const existing = await this.projectRepository.findBySlug(
      createProjectDto.slug,
    );
    if (existing) {
      throw new ConflictException('Slug already exists');
    }

    const data = this.mapDtoToEntityData(createProjectDto);
    this.logger.log(`Creating new project: ${createProjectDto.title}`);
    const project = await this.projectRepository.create(data);
    
    // Sync to RAG
    await this.aiService.syncDocument('project', project.id, project.content || project.description || '', {
      title: project.title,
      slug: project.slug,
      techStack: project.techStack,
    });
    
    return project;
  }

  async findAll(): Promise<Project[]> {
    return this.projectRepository.findAll();
  }

  async findOne(idOrSlug: string): Promise<Project | null> {
    let project = await this.projectRepository.findById(idOrSlug);
    if (!project) {
      project = await this.projectRepository.findBySlug(idOrSlug);
    }
    return project;
  }

  async update(
    id: string,
    updateProjectDto: UpdateProjectDto,
  ): Promise<Project> {
    if (updateProjectDto.slug) {
      const existing = await this.projectRepository.findBySlug(
        updateProjectDto.slug,
      );
      if (existing && existing.id !== id) {
        throw new ConflictException('Slug already exists');
      }
    }

    const data = this.mapDtoToEntityData(updateProjectDto);
    this.logger.log(`Updating project ID: ${id}`);
    const project = await this.projectRepository.update(id, data);
    
    // Sync to RAG
    await this.aiService.syncDocument('project', project.id, project.content || project.description || '', {
      title: project.title,
      slug: project.slug,
      techStack: project.techStack,
    });
    
    return project;
  }

  async remove(id: string): Promise<Project> {
    this.logger.log(`Removing project ID: ${id}`);
    const project = await this.projectRepository.delete(id);
    if (project) {
      await this.aiService.syncDocument('project', id, '', {}, 'delete');
    }
    return project;
  }
}
