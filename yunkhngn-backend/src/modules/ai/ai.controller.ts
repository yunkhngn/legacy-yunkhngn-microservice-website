import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiBody } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { FirebaseAuthGuard } from '../../common/guards';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';

@ApiTags('AI')
@Controller('ai')
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 20, ttl: 60000 } })
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('tarot')
  @ApiOperation({ summary: 'Generate tarot reading (public)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        question: { type: 'string' },
        cards: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              description: { type: 'string' },
            },
          },
        },
      },
    },
  })
  @Throttle({ default: { limit: 5, ttl: 300000 } })
  async generateTarotReading(
    @Body('question') question: string,
    @Body('cards') cards: { name: string; description: string }[],
  ) {
    if (!question || !cards || !Array.isArray(cards) || cards.length !== 3) {
      throw new HttpException(
        'Invalid request. Question and 3 cards are required.',
        HttpStatus.BAD_REQUEST,
      );
    }
    try {
      const analysis = await this.aiService.generateTarotReading(
        question,
        cards,
      );
      return { analysis };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        'AI service unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

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

  @Post('tools/what-to-eat')
  @ApiOperation({ summary: 'Suggest food based on location, weather, and time' })
  async whatToEat(
    @Body() body: { location: string; timezone: string },
  ) {
    if (!body.location) {
      throw new HttpException('location is required', HttpStatus.BAD_REQUEST);
    }
    return this.aiService.whatToEat(body);
  }

  @Post('tools/movie-suggest')
  @ApiOperation({ summary: 'Suggest movies based on mood and genres' })
  async movieSuggest(
    @Body() body: { mood: string; genres?: string[]; language?: string },
  ) {
    if (!body.mood) {
      throw new HttpException('mood is required', HttpStatus.BAD_REQUEST);
    }
    return this.aiService.movieSuggest(body);
  }

  @Post('tools/calorie-estimate')
  @ApiOperation({ summary: 'Estimate calories and macros for a food description query' })
  async calorieEstimate(
    @Body() body: { query: string },
  ) {
    if (!body.query) {
      throw new HttpException('query is required', HttpStatus.BAD_REQUEST);
    }
    return this.aiService.calorieEstimate(body);
  }
}

