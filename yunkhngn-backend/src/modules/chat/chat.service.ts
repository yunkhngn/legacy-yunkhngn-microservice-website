import { Injectable, Logger, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private aiServiceUrl: string;

  constructor(
    private configService: ConfigService,
    private settingsService: SettingsService,
  ) {
    this.aiServiceUrl = this.configService.get<string>('LETTER_AI_URL') || 'http://ai-service:8000';
  }

  private async callAiService(endpoint: string, body: any) {
    try {
      // Get API key from database (encrypted)
      let apiKey = await this.settingsService.getDecryptedSetting('gemini_api_key');
      if (!apiKey) {
        apiKey = this.configService.get<string>('GEMINI_API_KEY');
      }

      const response = await fetch(`${this.aiServiceUrl}/api/v1${endpoint}`, {
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
      this.logger.error('Error calling AI microservice:', error);
      throw new HttpException('Failed to connect to AI Service', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  async generateResponse(
    userMessage: string,
    history: any[] = [],
    language: string = 'vi',
  ): Promise<{ text: string; imageUrl?: string; sources?: any[] }> {
    // 1. Validation
    const settings = await this.settingsService.findAll();
    const settingsMap = settings.reduce(
      (acc, curr) => ({ ...acc, [curr.settingTitle]: curr.content }),
      {},
    );

    const MAX_WORD_COUNT = 100;
    const wordCount = userMessage.split(/\s+/).length;
    if (wordCount > MAX_WORD_COUNT) {
      throw new BadRequestException(
        `Message is too long. Limit is ${MAX_WORD_COUNT} words.`,
      );
    }

    const forbiddenWordsRaw = settingsMap['chat_forbidden_words'];
    if (forbiddenWordsRaw) {
      const forbiddenWords = forbiddenWordsRaw
        .split(/[,\n]+/)
        .map((w) => w.trim().toLowerCase())
        .filter(Boolean);

      const lowerCaseMessage = userMessage.toLowerCase();
      const foundForbidden = forbiddenWords.find((word) =>
        lowerCaseMessage.includes(word),
      );

      if (foundForbidden) {
        throw new BadRequestException(
          'Your message contains prohibited words.',
        );
      }
    }

    // 2. Proxy to Python AI Service
    return await this.callAiService('/chat/public', {
      message: userMessage,
      history: history.map(h => ({ role: h.role, content: h.content })),
      language,
    });
  }
}
