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

const SYSTEM_SETTINGS_MAP: Record<
  string,
  { keys: string[]; sortOrder: number; sensitive?: string[] }
> = {
  General: {
    keys: [
      'bio',
      'quote',
      'email',
      'homepage_description',
      'footer_description',
      'about_content',
      'comment_forbidden_keywords',
    ],
    sortOrder: 0,
  },
  Appearance: {
    keys: [
      'avatar',
      'about_image_story',
      'about_image_journey',
      'about_image_skills',
      'about_image_contact',
    ],
    sortOrder: 1,
  },
  'Social Media': {
    keys: ['facebook', 'github', 'instagram', 'tiktok', 'linkedin'],
    sortOrder: 2,
  },
  'Resume / CV': {
    keys: ['education', 'experience', 'skills', 'projects', 'cv_url'],
    sortOrder: 3,
  },
  Cloudinary: {
    keys: [
      'cloudinary_cloud_name',
      'cloudinary_api_key',
      'cloudinary_api_secret',
    ],
    sensitive: ['cloudinary_api_secret'],
    sortOrder: 4,
  },
  'Email / Resend': {
    keys: ['resend_api_key', 'resend_domain', 'admin_email'],
    sensitive: ['resend_api_key'],
    sortOrder: 5,
  },
  Cloudflare: {
    keys: [
      'cloudflare_zone_id',
      'cloudflare_account_id',
      'cloudflare_api_token',
    ],
    sensitive: ['cloudflare_api_token'],
    sortOrder: 6,
  },
  GitHub: {
    keys: ['github_api_key', 'github_username', 'github_repo_name'],
    sensitive: ['github_api_key'],
    sortOrder: 7,
  },
  'Music / Last.fm': {
    keys: ['lastfm_api_key', 'lastfm_username'],
    sensitive: ['lastfm_api_key'],
    sortOrder: 8,
  },
  Vercel: {
    keys: ['vercel_api_token', 'vercel_project_id', 'vercel_team_id'],
    sensitive: ['vercel_api_token'],
    sortOrder: 9,
  },
  AI: {
    keys: [
      'gemini_api_key',
      'gemini_api_keys',
      'ai_persona',
      'chat_api_key',
      'chat_forbidden_words',
    ],
    sensitive: ['gemini_api_key', 'gemini_api_keys', 'chat_api_key'],
    sortOrder: 10,
  },
  Other: {
    keys: ['journal_moods'],
    sortOrder: 99,
  },
};

const SYSTEM_SETTINGS = Object.values(SYSTEM_SETTINGS_MAP).flatMap(
  (g) => g.keys,
);

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

// Legacy list used only for seeding isSensitive on existing rows
const LEGACY_SENSITIVE_KEYS = [
  'gemini_api_key',
  'gemini_api_keys',
  'cloudinary_api_secret',
  'resend_api_key',
  'cloudflare_api_token',
  'github_api_key',
  'lastfm_api_key',
  'chat_api_key',
  'vercel_api_token',
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
      for (const [group, { keys, sortOrder, sensitive }] of Object.entries(
        SYSTEM_SETTINGS_MAP,
      )) {
        for (let i = 0; i < keys.length; i++) {
          const title = keys[i];
          const isSensitive = sensitive?.includes(title) ?? false;
          const existing = await this.settingsRepository.findByTitle(title);
          if (!existing) {
            await this.settingsRepository.upsert(
              title,
              '',
              group,
              sortOrder * 100 + i,
              isSensitive,
            );
          } else if (!existing.group || existing.group === 'Uncategorized') {
            await this.settingsRepository.updateGroup(
              existing.id,
              group,
              sortOrder * 100 + i,
            );
          }
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
      if (s.isSensitive && s.content) {
        return { ...s, content: '********' };
      }
      return s;
    });
  }

  async getGroupedSettings(): Promise<{ group: string; settings: any[] }[]> {
    const all = await this.settingsRepository.findAll();

    // Mask sensitive values using the DB flag
    const masked = all.map((s) => {
      if (s.isSensitive && s.content) {
        return { ...s, content: '********' };
      }
      return s;
    });

    // Group by `group` field
    const groupMap = new Map<string, any[]>();
    for (const s of masked) {
      const g = s.group || 'Uncategorized';
      if (!groupMap.has(g)) groupMap.set(g, []);
      groupMap.get(g).push(s);
    }

    // Sort groups by min sortOrder, sort settings within group by sortOrder
    return Array.from(groupMap.entries())
      .map(([group, settings]) => ({
        group,
        settings: settings.sort(
          (a, b) => (a.sortOrder || 0) - (b.sortOrder || 0),
        ),
      }))
      .sort((a, b) => {
        const aMin = Math.min(...a.settings.map((s) => s.sortOrder || 0));
        const bMin = Math.min(...b.settings.map((s) => s.sortOrder || 0));
        return aMin - bMin;
      });
  }

  async create(
    settingTitle: string,
    content: string,
    group?: string,
    isSensitive?: boolean,
  ) {
    if (await this.settingsRepository.findByTitle(settingTitle)) {
      throw new BadRequestException(`Setting "${settingTitle}" already exists`);
    }

    let finalContent = content || '';
    if (isSensitive && finalContent) {
      finalContent = this.encryptionService.encrypt(finalContent);
    }

    return this.settingsRepository.create(
      settingTitle,
      finalContent,
      group || 'Uncategorized',
      0,
      isSensitive ?? false,
    );
  }

  async findAll(): Promise<Setting[]> {
    return this.settingsRepository.findAll();
  }

  async update(updateSettingsDto: UpdateSettingsDto) {
    const { settingTitle } = updateSettingsDto;
    let { content } = updateSettingsDto;

    const existing = await this.settingsRepository.findByTitle(settingTitle);

    // Determine sensitivity: use DTO override if provided, otherwise keep existing
    const isSensitive =
      updateSettingsDto.isSensitive !== undefined
        ? updateSettingsDto.isSensitive
        : existing?.isSensitive ?? false;

    // Encrypt sensitive keys
    if (isSensitive) {
      if (content === '********') {
        // Ignore content update if it's the mask, but still allow group/sensitivity changes
        content = undefined;
      } else if (content !== undefined) {
        content = this.encryptionService.encrypt(content);
      }
    }

    const group =
      updateSettingsDto.group || existing?.group || 'Uncategorized';
    const sortOrder = updateSettingsDto.sortOrder ?? existing?.sortOrder ?? 0;

    this.logger.log(`Updating setting: ${settingTitle}`);

    // If content is undefined (masked sensitive), only update metadata without touching content
    if (content === undefined) {
      const metadata = {
        settingTitle,
        group,
        sortOrder,
        isSensitive,
      };

      const updated = updateSettingsDto.id
        ? await this.settingsRepository.update(updateSettingsDto.id, metadata)
        : await this.settingsRepository.upsert(
            settingTitle,
            existing?.content || '',
            group,
            sortOrder,
            isSensitive,
          );
      return updated;
    }

    const updatedSetting = updateSettingsDto.id
      ? await this.settingsRepository.update(updateSettingsDto.id, {
          settingTitle,
          content,
          group,
          sortOrder,
          isSensitive,
        })
      : await this.settingsRepository.upsert(
          settingTitle,
          content,
          group,
          sortOrder,
          isSensitive,
        );

    // Sync to RAG if it's content-related
    const RAG_SYNC_KEYS = [
      'about_content',
      'skills',
      'experience',
      'education',
      'bio',
    ];
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

      if (setting.isSensitive) {
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
    await this.settingsRepository.upsert(
      'gemini_api_keys',
      encrypted,
      'AI',
      1001,
      true,
    );
  }

  async getRandomApiKey() {
    // 1. Try the multi-key pool first
    const validKeys = await this._getKeyArray();
    if (validKeys.length > 0) {
      const randomIndex = Math.floor(Math.random() * validKeys.length);
      this.logger.debug(
        `Picked API key ${randomIndex + 1}/${validKeys.length}`,
      );
      return validKeys[randomIndex];
    }

    // 2. Fallback to single key
    return this.getDecryptedSetting('gemini_api_key');
  }

  async listApiKeys(): Promise<{
    keys: { index: number; masked: string; prefix: string }[];
    count: number;
  }> {
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

  async removeApiKey(
    index: number,
  ): Promise<{ message: string; count: number }> {
    const keys = await this._getKeyArray();

    if (index < 0 || index >= keys.length) {
      throw new BadRequestException(
        `Invalid key index: ${index}. Pool has ${keys.length} keys.`,
      );
    }

    const removed = keys.splice(index, 1);
    await this._saveKeyArray(keys);

    this.logger.log(
      `Removed API key ${removed[0].substring(0, 8)}... from pool (remaining: ${keys.length})`,
    );
    return { message: 'API key removed successfully', count: keys.length };
  }
}
