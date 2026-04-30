import { Injectable, HttpException, HttpStatus, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SettingsService } from '../settings/settings.service';

export interface ProjectInfo {
  title: string;
  description: string;
  content: string;
  techStack: string[];
  tags: string[];
  demoLink: string;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private aiServiceUrl: string;

  constructor(
    private configService: ConfigService,
    @Inject(forwardRef(() => SettingsService))
    private settingsService: SettingsService,
  ) {
    this.aiServiceUrl = this.configService.get<string>('LETTER_AI_URL') || 'http://ai-service:8000';
  }

  private async callAiService(endpoint: string, body: any, base: string = '/gemini') {
    try {
      // Get API key from database (encrypted)
      let apiKey = await this.settingsService.getRandomApiKey();
      if (!apiKey) {
        apiKey = this.configService.get<string>('GEMINI_API_KEY');
      }

      const response = await fetch(`${this.aiServiceUrl}/api/v1${base}${endpoint}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-gemini-api-key': apiKey || '',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new HttpException(
          errorData.detail || 'AI Service Error',
          response.status || HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Error calling AI microservice: ${error.message}`, error.stack);
      throw new HttpException('Failed to connect to AI Service', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  async generateText(prompt: string): Promise<string> {
    const data = await this.callAiService('/generate', { prompt });
    return data.text;
  }

  async generateProjectInfo(
    repoUrl: string,
    language: string = 'vi',
  ): Promise<ProjectInfo> {
    return await this.callAiService('/project-info', { readme_content: repoUrl, language });
  }

  async generateBlogContent(
    prompt: string,
    currentContent?: string,
    language: string = 'vi',
  ): Promise<{ title: string; tags: string[]; content: string }> {
    const data = await this.callAiService('/blog-content', {
      prompt,
      current_content: currentContent,
      language,
    });
    return data.content;
  }

  async generateDashboardSummary(
    stats: any,
    recentActivities: any[],
    language: string = 'vi',
  ): Promise<string> {
    const data = await this.callAiService('/dashboard-summary', {
      stats,
      recent_activities: recentActivities,
      language,
    });
    return data.summary;
  }

  async syncDocument(type: string, id: string, content: string, metadata: any = {}, action: 'upsert' | 'delete' = 'upsert') {
    try {
      await this.callAiService('/sync', {
        type,
        action,
        document: {
          id,
          type,
          content,
          metadata,
        },
      }, '/rag');
    } catch (error) {
      this.logger.error(`Failed to sync ${type} ${id} to AI Service: ${error.message}`);
      // We don't throw here to avoid breaking the main flow (e.g. blog save)
    }
  }

  async chatWithSystem(
    message: string,
    history: any[],
    language: string = 'vi',
  ) {
    return await this.callAiService('/chat', {
      message,
      history: history.map(h => ({ role: h.role, content: h.content })),
      language,
      context_data: {},
    });
  }

  async getRagStats(): Promise<any> {
    try {
      const response = await fetch(`${this.aiServiceUrl}/api/v1/rag/stats`);
      if (!response.ok) return { count: 0 };
      return await response.json();
    } catch {
      return { count: 0 };
    }
  }
}
