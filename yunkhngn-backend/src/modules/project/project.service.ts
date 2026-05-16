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
import { RagSyncQueue } from '../queue/rag-sync/rag-sync.queue';
import { NewsletterQueue } from '../queue/newsletter/newsletter.queue';

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
    private readonly ragSyncQueue: RagSyncQueue,
    private readonly newsletterQueue: NewsletterQueue,
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
    if (data.sendNewsletter !== undefined) {
      delete data.sendNewsletter;
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
    await this.ragSyncQueue.enqueue({
      op: 'upsert',
      type: 'project',
      docId: project.id,
      content: project.contentJSON || project.description || '',
      metadata: {
        title: project.title,
        slug: project.slug,
        techStack: project.techStack,
      },
    });

    if (createProjectDto.sendNewsletter) {
      this.logger.log(
        `Project created with sendNewsletter flag. Announcing ${project.title}...`,
      );
      await this.newsletterQueue.announce(project.id, 'project');
    }

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

    const relatedProjects = await this.findRelatedProjects(project);

    return {
      ...project,
      relatedProjects,
    };
  }

  async findRelatedProjects(current: Project): Promise<Project[]> {
    const TARGET = 3;

    const ragProjects: Project[] = [];
    try {
      const ragResults = await this.aiService.findSimilar(
        'project',
        current.id,
        TARGET,
      );
      if (ragResults.length > 0) {
        const ids = ragResults.map((r) => r.doc_id);
        const fetched = await this.projectRepository.findManyByIds(ids);
        ragProjects.push(...fetched);
      }
      if (ragProjects.length >= TARGET) {
        return ragProjects.slice(0, TARGET);
      }
    } catch (error) {
      this.logger.warn(`RAG search failed for project: ${error.message}`);
    }

    // Fallback: rank by tag/techStack overlap so the section never silently disappears
    // when RAG returns nothing.
    const need = TARGET - ragProjects.length;
    const excludeIds = [current.id, ...ragProjects.map((p) => p.id)];

    const normalize = (raw: string | null | undefined): string[] => {
      if (!raw) return [];
      const trimmed = raw.trim();
      // techStack may be a JSON-encoded array string
      if (trimmed.startsWith('[')) {
        try {
          const arr = JSON.parse(trimmed);
          if (Array.isArray(arr)) {
            return arr
              .map((x) => String(x).trim().toLowerCase())
              .filter(Boolean);
          }
        } catch {
          // fall through to comma-split
        }
      }
      return trimmed
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
    };

    const tagList = normalize(current.tags);
    const techList = normalize(current.techStack);

    const candidates = await this.projectRepository.findRelated(
      excludeIds,
      tagList,
      techList,
      Math.max(need * 5, 10),
    );

    const fillers = candidates
      .map((p) => {
        const candTags = normalize(p.tags);
        const candTech = normalize(p.techStack);
        const overlap =
          candTags.filter((t) => tagList.includes(t)).length +
          candTech.filter((t) => techList.includes(t)).length;
        return { project: p, overlap };
      })
      .sort((a, b) => {
        if (b.overlap !== a.overlap) return b.overlap - a.overlap;
        return (
          new Date(b.project.createdAt as any).getTime() -
          new Date(a.project.createdAt as any).getTime()
        );
      })
      .slice(0, need)
      .map((x) => x.project);

    return [...ragProjects, ...fillers].slice(0, TARGET);
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
    await this.ragSyncQueue.enqueue({
      op: 'upsert',
      type: 'project',
      docId: project.id,
      content: project.contentJSON || project.description || '',
      metadata: {
        title: project.title,
        slug: project.slug,
        techStack: project.techStack,
      },
    });

    if (updateProjectDto.sendNewsletter) {
      this.logger.log(
        `Project updated with sendNewsletter flag. Announcing ${project.title}...`,
      );
      await this.newsletterQueue.announce(project.id, 'project');
    }

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

    await this.ragSyncQueue.enqueue({ op: 'delete', type: 'project', docId: id });

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
