import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiBody } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { FirebaseAuthGuard } from '../../common/guards';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';

@ApiTags('AI')
@Controller('ai')
@UseGuards(FirebaseAuthGuard, ThrottlerGuard)
@Throttle({ default: { limit: 20, ttl: 60000 } })
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('generate')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate generic text using AI' })
  @ApiBody({
    schema: { type: 'object', properties: { prompt: { type: 'string' } } },
  })
  @UseGuards(FirebaseAuthGuard)
  async generate(@Body('prompt') prompt: string) {
    if (!prompt) {
      throw new Error('Prompt is required');
    }
    const text = await this.aiService.generateText(prompt);
    return { text };
  }

  @Post('project-info')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Generate project intro/tech stack from GitHub URL',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        repoUrl: { type: 'string' },
        language: { type: 'string', default: 'vi' },
      },
    },
  })
  @UseGuards(FirebaseAuthGuard)
  async generateProjectInfo(
    @Body('repoUrl') repoUrl: string,
    @Body('language') language: string,
  ) {
    if (!repoUrl) {
      throw new Error('Repo URL is required');
    }
    return this.aiService.generateProjectInfo(repoUrl, language);
  }

  @Post('blog-content')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Draft or edit blog content using AI' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        prompt: { type: 'string' },
        currentContent: { type: 'string' },
        language: { type: 'string', default: 'vi' },
      },
    },
  })
  @UseGuards(FirebaseAuthGuard)
  async generateBlogContent(
    @Body('prompt') prompt: string,
    @Body('currentContent') currentContent: string,
    @Body('language') language: string,
  ) {
    if (!prompt) {
      throw new Error('Prompt is required');
    }
    const content = await this.aiService.generateBlogContent(
      prompt,
      currentContent,
      language,
    );
    return { content };
  }

  @Post('dashboard-summary')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Generate a periodic summary for the admin dashboard',
  })
  @UseGuards(FirebaseAuthGuard)
  async generateDashboardSummary(
    @Body('stats') stats: any,
    @Body('recentActivities') recentActivities: any[],
    @Body('language') language: string,
  ) {
    const summary = await this.aiService.generateDashboardSummary(
      stats,
      recentActivities || [],
      language,
    );
    return { summary };
  }

  @Post('chat')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Chat with AI assistant about system data' })
  @UseGuards(FirebaseAuthGuard)
  async chatWithSystem(
    @Body() data: { message: string; history: any[]; language?: string },
  ) {
    return this.aiService.chatWithSystem(
      data.message,
      data.history || [],
      data.language,
    );
  }

  @Get('rag/stats')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get RAG vector database statistics' })
  @UseGuards(FirebaseAuthGuard)
  async getRagStats() {
    return this.aiService.getRagStats();
  }
}
