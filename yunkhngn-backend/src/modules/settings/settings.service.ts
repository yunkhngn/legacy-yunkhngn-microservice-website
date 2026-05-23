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
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuditAction, AuditEntity } from '../audit-logs/domain/audit-log.types';

const SYSTEM_SETTINGS_MAP: Record<
  string,
  { keys: string[]; sortOrder: number; sensitive?: string[]; public?: string[] }
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
    public: [
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
  Newsletter: {
    keys: ['newsletter_auto_blog', 'newsletter_auto_project'],
    sortOrder: 9,
  },
  Appearance: {
    keys: [
      'avatar',
      'about_image_story',
      'about_image_journey',
      'about_image_skills',
      'about_image_contact',
    ],
    public: [
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
    public: ['facebook', 'github', 'instagram', 'tiktok', 'linkedin'],
    sortOrder: 2,
  },
  'Resume / CV': {
    keys: ['education', 'experience', 'skills', 'cv_url'],
    public: ['education', 'experience', 'skills', 'cv_url'],
    sortOrder: 3,
  },
  Cloudinary: {
    keys: [
      'cloudinary_cloud_name',
      'cloudinary_api_key',
      'cloudinary_api_secret',
    ],
    sensitive: ['cloudinary_api_secret'],
    public: ['cloudinary_cloud_name'],
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
    public: ['github_username', 'github_repo_name'],
    sortOrder: 7,
  },
  'Music / Last.fm': {
    keys: ['lastfm_api_key', 'lastfm_username'],
    sensitive: ['lastfm_api_key'],
    public: ['lastfm_username'],
    sortOrder: 8,
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
    public: ['ai_persona', 'chat_forbidden_words'],
    sortOrder: 10,
  },
  WakaTime: {
    keys: ['wakatime_api_key'],
    sensitive: ['wakatime_api_key'],
    sortOrder: 11,
  },
  Steam: {
    keys: ['steam_api_key', 'steam_user_id'],
    sensitive: ['steam_api_key'],
    public: ['steam_user_id'],
    sortOrder: 12,
  },
  Weather: {
    keys: ['openweather_api_key'],
    sensitive: ['openweather_api_key'],
    sortOrder: 13,
  },
  Locket: {
    keys: ['locket_email', 'locket_password', 'locket_api_key'],
    sensitive: ['locket_password', 'locket_api_key'],
    sortOrder: 14,
  },
  Other: {
    keys: ['journal_moods'],
    public: ['journal_moods'],
    sortOrder: 99,
  },
};

@Injectable()
export class SettingsService implements OnModuleInit {
  private readonly logger: Logger;

  constructor(
    @Inject(ISettingsRepository)
    private readonly settingsRepository: ISettingsRepository,
    private readonly encryptionService: EncryptionService,
    @Inject(forwardRef(() => AiService))
    private readonly aiService: AiService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly auditLogsService: AuditLogsService,
  ) {
    this.logger = new Logger(SettingsService.name);
  }

  async onModuleInit() {
    try {
      this.logger.log('Initializing system settings');
      for (const [group, { keys, sortOrder, sensitive, public: publicKeys }] of Object.entries(
        SYSTEM_SETTINGS_MAP,
      )) {
        for (let i = 0; i < keys.length; i++) {
          const title = keys[i];
          const isSensitive = sensitive?.includes(title) ?? false;
          const isPublic = publicKeys?.includes(title) ?? false;

          const existing = await this.settingsRepository.findByTitle(title);
          if (!existing) {
            await this.settingsRepository.upsert(
              title,
              '',
              group,
              sortOrder * 100 + i,
              isSensitive,
              true, // isSystem
              isPublic,
            );
          } else {
            // If it should be sensitive but doesn't look encrypted (no colon separator), encrypt it
            let contentToSave = existing.content;
            if (isSensitive && existing.content && !existing.content.includes(':')) {
              this.logger.log(`Encrypting plaintext setting to match sensitivity flag: ${title}`);
              contentToSave = this.encryptionService.encrypt(existing.content);
            }

            await this.settingsRepository.upsert(
              title,
              contentToSave,
              group,
              existing.sortOrder || sortOrder * 100 + i,
              existing.isSensitive || isSensitive,
              true, // isSystem
              isPublic,
            );
          }
        }
      }

      // Cleanup: Unset isSystem for orphaned settings
      const allSettings = await this.settingsRepository.findAll();
      const allMappedKeys = Object.values(SYSTEM_SETTINGS_MAP).flatMap(g => g.keys);

      for (const s of allSettings) {
        if (s.isSystem && !allMappedKeys.includes(s.settingTitle)) {
          this.logger.log(`Unmarking orphaned system setting: ${s.settingTitle}`);
          await this.settingsRepository.update(s.id, { isSystem: false });
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
    const all = await this.settingsRepository.findAll();
    return all.filter(s => s.isPublic);
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
    const isSystem = updateSettingsDto.isSystem ?? existing?.isSystem ?? false;
    const isPublic = updateSettingsDto.isPublic ?? existing?.isPublic ?? false;

    this.logger.log(`Updating setting: ${settingTitle}`);
    await this.cacheManager.del('public_settings');
    await this.cacheManager.del(this.decryptedSettingCacheKey(settingTitle));

    // If content is undefined (masked sensitive), only update metadata without touching content
    if (content === undefined) {
      const metadata = {
        settingTitle,
        group,
        sortOrder,
        isSensitive,
        isSystem,
        isPublic,
      };

      const updated = updateSettingsDto.id
        ? await this.settingsRepository.update(updateSettingsDto.id, metadata)
        : await this.settingsRepository.upsert(
          settingTitle,
          existing?.content || '',
          group,
          sortOrder,
          isSensitive,
          isSystem,
          isPublic,
        );

      void this.auditLogsService.log({
        action: settingTitle === 'ai_persona' ? AuditAction.UPDATE_AI_PERSONA : AuditAction.UPDATE_SETTINGS,
        entity: settingTitle === 'ai_persona' ? AuditEntity.AI_PERSONA : AuditEntity.SETTINGS,
        entityId: updated.id.toString(),
        details: { settingTitle, isSensitive, isSystem, isPublic, group, sortOrder },
      });

      return updated;
    }

    const updatedSetting = updateSettingsDto.id
      ? await this.settingsRepository.update(updateSettingsDto.id, {
        settingTitle,
        content,
        group,
        sortOrder,
        isSensitive,
        isSystem,
        isPublic,
      })
      : await this.settingsRepository.upsert(
        settingTitle,
        content,
        group,
        sortOrder,
        isSensitive,
        isSystem,
        isPublic,
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

    void this.auditLogsService.log({
      action: settingTitle === 'ai_persona' ? AuditAction.UPDATE_AI_PERSONA : AuditAction.UPDATE_SETTINGS,
      entity: settingTitle === 'ai_persona' ? AuditEntity.AI_PERSONA : AuditEntity.SETTINGS,
      entityId: updatedSetting.id.toString(),
      details: {
        settingTitle,
        isSensitive,
        isSystem,
        isPublic,
        group,
        sortOrder,
        content: isSensitive ? '[REDACTED]' : content,
      },
    });

    return updatedSetting;
  }

  async delete(id: number) {
    const setting = await this.settingsRepository.findById(id);
    if (setting && setting.isSystem) {
      throw new BadRequestException(
        `Cannot delete system setting: ${setting.settingTitle}`,
      );
    }

    this.logger.log(`Deleting setting ID: ${id}`);
    return this.settingsRepository.delete(id);
  }

  private decryptedSettingCacheKey(title: string) {
    return `decrypted_setting:${title}`;
  }

  async getDecryptedSetting(title: string): Promise<string | null> {
    const cacheKey = this.decryptedSettingCacheKey(title);

    try {
      const cached = await this.cacheManager.get<string>(cacheKey);
      if (cached !== undefined && cached !== null) {
        // We cache the empty string as a sentinel for "no value" so we don't
        // re-query the DB for missing settings on every request.
        return cached === '' ? null : cached;
      }
    } catch {
      // Cache backend unavailable — fall through to DB.
    }

    try {
      const setting = await this.settingsRepository.findByTitle(title);

      let value: string | null = null;
      if (setting?.content) {
        value = setting.isSensitive
          ? this.encryptionService.decrypt(setting.content)
          : setting.content;
      }

      try {
        await this.cacheManager.set(cacheKey, value ?? '', 300);
      } catch {
        // Best-effort cache write.
      }

      return value;
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
    await this.cacheManager.del(this.decryptedSettingCacheKey('gemini_api_keys'));
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
