import {
  Injectable,
  OnModuleInit,
  BadRequestException,
  Inject,
  Logger,
} from '@nestjs/common';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { EncryptionService } from '../../common/encryption.service';
import { ISettingsRepository } from './domain/settings.repository.interface';
import { Setting } from './domain/setting.entity';

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
  'cloudinary_api_secret',
  'resend_api_key',
  'cloudflare_api_token',
  'github_api_key',
  'lastfm_api_key',
  'chat_api_key',
];

@Injectable()
export class SettingsService implements OnModuleInit {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    @Inject(ISettingsRepository)
    private readonly settingsRepository: ISettingsRepository,
    private readonly encryptionService: EncryptionService,
  ) {}

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
    return this.settingsRepository.upsert(settingTitle, content);
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
      this.logger.warn(
        `Failed to fetch and decrypt setting: ${title}`,
        error.message,
      );
      return null;
    }
  }
}
