import { Injectable, ConflictException, Inject, Logger } from '@nestjs/common';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { IProjectRepository } from './domain/project.repository.interface';
import { Project } from './domain/project.entity';
import { AiService } from '../ai/ai.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuditAction, AuditEntity } from '../audit-logs/domain/audit-log.types';
import { CloudinaryService } from '../integrations/cloudinary/cloudinary.service';
import { extractImagesFromJsonContent } from '../../common/utils/image-extractor.util';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class ProjectService {
  private readonly logger = new Logger(ProjectService.name);

  constructor(
    @Inject(IProjectRepository)
    private readonly projectRepository: IProjectRepository,
    private readonly aiService: AiService,
    private readonly auditLogsService: AuditLogsService,
    private readonly cloudinaryService: CloudinaryService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
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
    await this.cacheManager.del('admin_dashboard_stats');

    // Sync to RAG
    await this.aiService.syncDocument(
      'project',
      project.id,
      project.contentJSON || project.description || '',
      {
        title: project.title,
        slug: project.slug,
        techStack: project.techStack,
      },
    );

    await this.auditLogsService.log({
      action: AuditAction.CREATE_PROJECT,
      entity: AuditEntity.PROJECT,
      entityId: project.id,
      details: { title: project.title, slug: project.slug },
    });

    return project;
  }

  async findAll(limit?: number): Promise<Project[]> {
    return this.projectRepository.findAll(limit);
  }

  async findOne(idOrSlug: string): Promise<any> {
    let project = await this.projectRepository.findById(idOrSlug);
    if (!project) {
      project = await this.projectRepository.findBySlug(idOrSlug);
    }
    if (!project) return null;

    const relatedProjects = await this.findRelatedProjects(project.id);

    return {
      ...project,
      relatedProjects,
    };
  }

  async findRelatedProjects(currentId: string): Promise<Project[]> {
    try {
      const ragResults = await this.aiService.findSimilar(
        'project',
        currentId,
        3,
      );
      if (ragResults.length > 0) {
        const projects: Project[] = [];
        for (const result of ragResults) {
          const proj = await this.projectRepository.findById(result.doc_id);
          if (proj) {
            projects.push(proj);
          }
        }
        return projects;
      }
    } catch (error) {
      this.logger.warn(`RAG search failed for project: ${error.message}`);
    }
    return [];
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

    const currentProject = await this.projectRepository.findById(id);
    if (!currentProject) throw new ConflictException('Project not found');

    const data = this.mapDtoToEntityData(updateProjectDto);
    this.logger.log(`Updating project ID: ${id}`);

    // --- NEW: Collect old images to delete ---
    const imagesToDelete: string[] = [];
    if (data.cover !== undefined && data.cover !== currentProject.cover) {
      if (currentProject.cover) imagesToDelete.push(currentProject.cover);
    }
    if (
      data.seoImage !== undefined &&
      data.seoImage !== currentProject.seoImage
    ) {
      if (currentProject.seoImage) imagesToDelete.push(currentProject.seoImage);
    }
    if (data.contentJSON !== undefined) {
      const oldImages = extractImagesFromJsonContent(
        currentProject.contentJSON,
      );
      const newImages = extractImagesFromJsonContent(data.contentJSON);
      imagesToDelete.push(
        ...oldImages.filter((img) => !newImages.includes(img)),
      );
    }
    const project = await this.projectRepository.update(id, data);
    await this.cacheManager.del('admin_dashboard_stats');

    // Sync to RAG
    await this.aiService.syncDocument(
      'project',
      project.id,
      project.contentJSON || project.description || '',
      {
        title: project.title,
        slug: project.slug,
        techStack: project.techStack,
      },
    );

    if (imagesToDelete.length > 0) {
      void this.cloudinaryService.deleteImagesSafely(imagesToDelete);
    }

    await this.auditLogsService.log({
      action: AuditAction.UPDATE_PROJECT,
      entity: AuditEntity.PROJECT,
      entityId: id,
      details: { title: project.title, slug: project.slug },
    });

    return project;
  }

  async remove(id: string): Promise<Project> {
    this.logger.log(`Removing project ID: ${id}`);
    const project = await this.projectRepository.delete(id);
    await this.cacheManager.del('admin_dashboard_stats');
    if (!project) {
      return project;
    }

    await this.aiService.syncDocument('project', id, '', {}, 'delete');

    const imagesToDelete = [
      project.cover,
      project.seoImage,
      ...extractImagesFromJsonContent(project.contentJSON),
    ];
    void this.cloudinaryService.deleteImagesSafely(imagesToDelete);

    await this.auditLogsService.log({
      action: AuditAction.DELETE_PROJECT,
      entity: AuditEntity.PROJECT,
      entityId: id,
      details: { title: project.title, slug: project.slug },
    });

    return project;
  }
}
