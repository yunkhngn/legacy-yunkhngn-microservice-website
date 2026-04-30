import {
  Injectable,
  OnModuleInit,
  BadRequestException,
  Inject,
  Logger,
  forwardRef,
} from '@nestjs/common';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { EncryptionService } from '../../common/encryption.service';
import { ISettingsRepository } from './domain/settings.repository.interface';
import { Setting } from './domain/setting.entity';
import { AiService } from '../ai/ai.service';

const SYSTEM_SETTINGS = [
  'bio',
  'quote',
  'facebook',
  'github',
  'instagram',
  'linkedin',
  'tiktok',
  'email',
  'homepage_description',
  'footer_description',
  'about_content',
  'comment_forbidden_keywords',
  'chat_forbidden_words',
  'education',
  'experience',
  'skills',
  'cv_url',
  'gemini_api_key',
  'gemini_api_keys',
  'ai_persona',
  'cloudinary_cloud_name',
  'cloudinary_api_key',
  'cloudinary_api_secret',
  'resend_api_key',
  'resend_domain',
  'admin_email',
  'cloudflare_zone_id',
  'cloudflare_account_id',
  'cloudflare_api_token',
  'github_api_key',
  'github_username',
  'github_repo_name',
  'chat_api_key',
  'avatar',
  'about_image_story',
  'about_image_journey',
  'about_image_skills',
  'about_image_contact',
  'lastfm_api_key',
  'lastfm_username',
  'journal_moods',
];

const PUBLIC_SETTINGS = [
  'bio',
  'quote',
  'facebook',
  'github',
  'instagram',
  'linkedin',
  'tiktok',
  'email',
  'homepage_description',
  'footer_description',
  'about_content',
  'education',
  'experience',
  'skills',
  'cv_url',
  'cloudinary_cloud_name',
  'avatar',
  'about_image_story',
  'about_image_journey',
  'about_image_skills',
  'about_image_contact',
  'lastfm_username',
  'github_username',
  'github_repo_name',
  'comment_forbidden_keywords',
  'chat_forbidden_words',
  'ai_persona',
  'journal_moods',
];

const SENSITIVE_KEYS = [
  'gemini_api_key',
  'gemini_api_keys',
  'cloudinary_api_secret',
  'resend_api_key',
  'cloudflare_api_token',
  'github_api_key',
  'lastfm_api_key',
  'chat_api_key',
];

@Injectable()
export class SettingsService implements OnModuleInit {
  private readonly logger: Logger;

  constructor(
    @Inject(ISettingsRepository)
    private readonly settingsRepository: ISettingsRepository,
    private readonly encryptionService: EncryptionService,
    @Inject(forwardRef(() => AiService))
    private readonly aiService: AiService,
  ) {
    this.logger = new Logger(SettingsService.name);
  }

  async onModuleInit() {
    try {
      this.logger.log('Initializing system settings');
      for (const title of SYSTEM_SETTINGS) {
        const existing = await this.settingsRepository.findByTitle(title);
        if (!existing) {
          await this.settingsRepository.upsert(title, '');
        }
      }
    } catch (error) {
      this.logger.error('Failed to initialize settings', error.stack);
    }
  }

  async getSettings() {
    return this.getPublicSettings();
  }

  async getPublicSettings(): Promise<Setting[]> {
    return this.settingsRepository.findByTitles(PUBLIC_SETTINGS);
  }

  async getAdminSettings(): Promise<any[]> {
    const settings = await this.settingsRepository.findAll();

    return settings.map((s) => {
      // Mask sensitive keys for admin UI
      if (SENSITIVE_KEYS.includes(s.settingTitle) && s.content) {
        return { ...s, content: '********' };
      }
      return s;
    });
  }

  async findAll(): Promise<Setting[]> {
    return this.settingsRepository.findAll();
  }

  async update(updateSettingsDto: UpdateSettingsDto) {
    const { settingTitle } = updateSettingsDto;
    let { content } = updateSettingsDto;

    // Encrypt sensitive keys
    if (SENSITIVE_KEYS.includes(settingTitle)) {
      if (content === '********') {
        // Ignore update if it's the mask
        return;
      }
      content = this.encryptionService.encrypt(content);
    }

    this.logger.log(`Updating setting: ${settingTitle}`);
    const updatedSetting = await this.settingsRepository.upsert(settingTitle, content);

    // Sync to RAG if it's content-related
    const RAG_SYNC_KEYS = ['about_content', 'skills', 'experience', 'education', 'bio'];
    if (RAG_SYNC_KEYS.includes(settingTitle)) {
      await this.aiService.syncDocument('setting', settingTitle, content, {
        title: settingTitle,
      });
    }

    return updatedSetting;
  }

  async delete(id: number) {
    const setting = await this.settingsRepository.findById(id);
    if (setting && SYSTEM_SETTINGS.includes(setting.settingTitle)) {
      throw new BadRequestException(
        `Cannot delete system setting: ${setting.settingTitle}`,
      );
    }

    this.logger.log(`Deleting setting ID: ${id}`);
    return this.settingsRepository.delete(id);
  }

  async getDecryptedSetting(title: string) {
    try {
      const setting = await this.settingsRepository.findByTitle(title);

      if (!setting || !setting.content) return null;

      if (SENSITIVE_KEYS.includes(title)) {
        return this.encryptionService.decrypt(setting.content);
      }

      return setting.content;
    } catch (error) {
      this.logger?.warn(
        `Failed to fetch and decrypt setting: ${title}`,
        error.message,
      );
      return null;
    }
  }

  // --- Internal: get the raw key array from DB ---
  private async _getKeyArray(): Promise<string[]> {
    const raw = await this.getDecryptedSetting('gemini_api_keys');
    if (!raw) return [];
    try {
      const keys: string[] = JSON.parse(raw);
      return keys.filter((k) => k && k.trim().length > 0);
    } catch {
      this.logger.warn('gemini_api_keys is not valid JSON');
      return [];
    }
  }

  private async _saveKeyArray(keys: string[]): Promise<void> {
    const content = JSON.stringify(keys);
    const encrypted = this.encryptionService.encrypt(content);
    await this.settingsRepository.upsert('gemini_api_keys', encrypted);
  }

  async getRandomApiKey(): Promise<string | null> {
    // 1. Try the multi-key pool first
    const validKeys = await this._getKeyArray();
    if (validKeys.length > 0) {
      const randomIndex = Math.floor(Math.random() * validKeys.length);
      this.logger.debug(`Picked API key ${randomIndex + 1}/${validKeys.length}`);
      return validKeys[randomIndex];
    }

    // 2. Fallback to single key
    return this.getDecryptedSetting('gemini_api_key');
  }

  async listApiKeys(): Promise<{ keys: { index: number; masked: string; prefix: string }[]; count: number }> {
    const keys = await this._getKeyArray();
    return {
      count: keys.length,
      keys: keys.map((k, i) => ({
        index: i,
        masked: k.substring(0, 8) + '...' + k.substring(k.length - 4),
        prefix: k.substring(0, 8),
      })),
    };
  }

  async addApiKey(key: string): Promise<{ message: string; count: number }> {
    if (!key || key.trim().length === 0) {
      throw new BadRequestException('API key cannot be empty');
    }

    const keys = await this._getKeyArray();

    // Check duplicate by prefix
    if (keys.some((k) => k === key.trim())) {
      throw new BadRequestException('This API key already exists in the pool');
    }

    keys.push(key.trim());
    await this._saveKeyArray(keys);

    this.logger.log(`Added API key to pool (total: ${keys.length})`);
    return { message: 'API key added successfully', count: keys.length };
  }

  async removeApiKey(index: number): Promise<{ message: string; count: number }> {
    const keys = await this._getKeyArray();

    if (index < 0 || index >= keys.length) {
      throw new BadRequestException(`Invalid key index: ${index}. Pool has ${keys.length} keys.`);
    }

    const removed = keys.splice(index, 1);
    await this._saveKeyArray(keys);

    this.logger.log(`Removed API key ${removed[0].substring(0, 8)}... from pool (remaining: ${keys.length})`);
    return { message: 'API key removed successfully', count: keys.length };
  }
}
