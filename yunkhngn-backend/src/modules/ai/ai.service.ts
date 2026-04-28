import { Injectable, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IBlogRepository } from '../blog/domain/blog.repository.interface';
import { IProjectRepository } from '../project/domain/project.repository.interface';
import { IGalleryRepository } from '../gallery/domain/gallery.repository.interface';

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
  private aiServiceUrl: string;

  constructor(
    private configService: ConfigService,
    @Inject(IBlogRepository)
    private readonly blogRepository: IBlogRepository,
    @Inject(IProjectRepository)
    private readonly projectRepository: IProjectRepository,
    @Inject(IGalleryRepository)
    private readonly galleryRepository: IGalleryRepository,
  ) {
    this.aiServiceUrl = this.configService.get<string>('LETTER_AI_URL') || 'http://ai-service:8000';
  }

  private async callAiService(endpoint: string, body: any) {
    try {
      const response = await fetch(`${this.aiServiceUrl}/api/v1/gemini${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      console.error('Error calling AI microservice:', error);
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

  async chatWithSystem(
    message: string,
    history: any[],
    language: string = 'vi',
  ) {
    // 1. Fetch all relevant data from repositories
    const blogs = await this.blogRepository.findAll();
    const projects = await this.projectRepository.findAll();
    const galleryRes = await this.galleryRepository.findAll({ take: 100 });
    const gallery = galleryRes.data;

    // 2. Construct context for Python service
    const context_data = {
      blogs: blogs.map((b: any) => `- ${b.title} (${b.status}): ${b.contentJSON.substring(0, 200)}...`).join('\n'),
      projects: projects.map((p: any) => `- ${p.title}: ${p.description} (Tech: ${p.techStack})`).join('\n'),
      gallery: gallery.map((g: any) => `- Photo: ${g.caption} (${new Date(g.createdAt).toISOString()})`).join('\n'),
    };

    return await this.callAiService('/chat', {
      message,
      history: history.map(h => ({ role: h.role, content: h.content })),
      context_data,
      language,
    });
  }
}
