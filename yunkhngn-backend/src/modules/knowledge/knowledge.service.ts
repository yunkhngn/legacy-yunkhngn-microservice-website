import { Injectable, Inject, Logger } from '@nestjs/common';
import { IKnowledgeRepository } from './domain/knowledge.repository.interface';
import { KnowledgeEntry } from './domain/knowledge.entity';
import { CreateKnowledgeDto } from './dto/create-knowledge.dto';
import { UpdateKnowledgeDto } from './dto/update-knowledge.dto';
import { AiService } from '../ai/ai.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuditAction, AuditEntity } from '../audit-logs/domain/audit-log.types';

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(
    @Inject(IKnowledgeRepository)
    private readonly knowledgeRepository: IKnowledgeRepository,
    private readonly aiService: AiService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async create(dto: CreateKnowledgeDto): Promise<KnowledgeEntry> {
    const entry = await this.knowledgeRepository.create({
      category: dto.category || 'general',
      title: dto.title,
      content: dto.content,
    });

    // Sync to vector DB
    await this.syncToRag(entry);

    void this.auditLogsService.log({
      action: AuditAction.CREATE_KNOWLEDGE,
      entity: AuditEntity.KNOWLEDGE,
      entityId: entry.id,
      details: { title: entry.title, category: entry.category },
    });

    return entry;
  }

  async findAll(): Promise<KnowledgeEntry[]> {
    return this.knowledgeRepository.findAll();
  }

  async findById(id: string): Promise<KnowledgeEntry | null> {
    return this.knowledgeRepository.findById(id);
  }

  async getCategories(): Promise<string[]> {
    return this.knowledgeRepository.getCategories();
  }

  async update(id: string, dto: UpdateKnowledgeDto): Promise<KnowledgeEntry> {
    const entry = await this.knowledgeRepository.update(id, dto);

    // Re-sync to vector DB
    await this.syncToRag(entry);

    void this.auditLogsService.log({
      action: AuditAction.UPDATE_KNOWLEDGE,
      entity: AuditEntity.KNOWLEDGE,
      entityId: entry.id,
      details: dto as Record<string, unknown>,
    });

    return entry;
  }

  async delete(id: string): Promise<KnowledgeEntry> {
    const entry = await this.knowledgeRepository.delete(id);

    // Remove from vector DB
    try {
      await this.aiService.syncDocument('knowledge', id, '', {}, 'delete');
    } catch (error) {
      this.logger.error(
        `Failed to delete knowledge ${id} from RAG: ${error.message}`,
      );
    }

    void this.auditLogsService.log({
      action: AuditAction.DELETE_KNOWLEDGE,
      entity: AuditEntity.KNOWLEDGE,
      entityId: id,
      details: { id },
    });

    return entry;
  }

  private async syncToRag(entry: KnowledgeEntry): Promise<void> {
    try {
      const fullContent = `${entry.title}\n\n${entry.content}`;
      await this.aiService.syncDocument('knowledge', entry.id, fullContent, {
        title: entry.title,
        category: entry.category,
      });
      await this.knowledgeRepository.update(entry.id, { synced: true });
      this.logger.log(`Synced knowledge entry: ${entry.title}`);
    } catch (error) {
      this.logger.error(
        `Failed to sync knowledge ${entry.id}: ${error.message}`,
      );
      await this.knowledgeRepository.update(entry.id, { synced: false });
    }
  }

  async syncAll(): Promise<{ synced: number; failed: number }> {
    const entries = await this.knowledgeRepository.findAll();
    let synced = 0;
    let failed = 0;

    for (const entry of entries) {
      try {
        await this.syncToRag(entry);
        synced++;
        // Small delay to avoid rate limits
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch {
        failed++;
      }
    }

    return { synced, failed };
  }
}
