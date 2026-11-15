import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SettingsService } from '../../settings/settings.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import axios from 'axios';

export interface ValorantRecentActivity {
  agent: string;
  agent_icon: string | null;
  mode: string;
  map: string;
  won: boolean | null;
  kills: number;
  deaths: number;
  assists: number;
  tier_patched: string | null;
  played_at: string;
  is_recent: boolean;
}

const CACHE_TTL_SECONDS = 120;
const RECENT_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours

@Injectable()
export class ValorantService {
  private readonly logger = new Logger(ValorantService.name);
  private readonly baseUrl = 'https://api.henrikdev.xyz';

  constructor(
    private configService: ConfigService,
    private settingsService: SettingsService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  private async getConfig(): Promise<{
    name: string | null;
    tag: string | null;
    region: string;
    apiKey: string | null;
  }> {
    const [name, tag, region, apiKey] = await Promise.all([
      this.settingsService.getDecryptedSetting('valorant_name'),
      this.settingsService.getDecryptedSetting('valorant_tag'),
      this.settingsService.getDecryptedSetting('valorant_region'),
      this.settingsService.getDecryptedSetting('henrikdev_api_key'),
    ]);

    return {
      name: name || this.configService.get<string>('VALORANT_NAME') || null,
      tag: tag || this.configService.get<string>('VALORANT_TAG') || null,
      region: region || this.configService.get<string>('VALORANT_REGION') || 'ap',
      apiKey: apiKey || this.configService.get<string>('HENRIKDEV_API_KEY') || null,
    };
  }

  async getRecentActivity(): Promise<ValorantRecentActivity | null> {
    const cacheKey = 'valorant_recent';
    const cached = await this.cacheManager.get<ValorantRecentActivity>(cacheKey);
    if (cached) return cached;

    const { name, tag, region, apiKey } = await this.getConfig();
    if (!name || !tag) {
      this.logger.warn('Valorant name or tag not configured');
      return null;
    }

    try {
      const headers: Record<string, string> = {};
      if (apiKey) headers['Authorization'] = apiKey;

      const res = await axios.get(
        `${this.baseUrl}/valorant/v3/matches/${region}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`,
        { params: { size: 1 }, headers, timeout: 8000 },
      );

      const match = res.data?.data?.[0];
      if (!match) return null;

      const allPlayers: any[] = match.players?.all_players ?? [];
      const me = allPlayers.find(
        (p: any) =>
          p.name?.toLowerCase() === name.toLowerCase() &&
          p.tag?.toLowerCase() === tag.toLowerCase(),
      );

      if (!me) return null;

      const myTeam: string = me.team?.toLowerCase();
      const teams = match.teams ?? {};
      const won: boolean | null =
        myTeam && teams[myTeam] != null ? teams[myTeam].has_won : null;

      const playedAt = new Date(
        (match.metadata?.game_start ?? 0) * 1000,
      ).toISOString();
      const isRecent =
        Date.now() - new Date(playedAt).getTime() < RECENT_THRESHOLD_MS;

      const result: ValorantRecentActivity = {
        agent: me.character ?? 'Unknown',
        agent_icon: me.assets?.agent?.small ?? null,
        mode: match.metadata?.mode ?? 'Unknown',
        map: match.metadata?.map ?? 'Unknown',
        won,
        kills: me.stats?.kills ?? 0,
        deaths: me.stats?.deaths ?? 0,
        assists: me.stats?.assists ?? 0,
        tier_patched: me.currenttier_patched ?? null,
        played_at: playedAt,
        is_recent: isRecent,
      };

      await this.cacheManager.set(cacheKey, result, CACHE_TTL_SECONDS);
      return result;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      this.logger.error('Failed to fetch Valorant data', error?.message);
      return null;
    }
  }
}
