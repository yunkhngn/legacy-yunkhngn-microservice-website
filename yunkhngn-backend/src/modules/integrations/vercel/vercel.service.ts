import { Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../../settings/settings.service';

@Injectable()
export class VercelService {
  private readonly logger = new Logger(VercelService.name);

  constructor(private readonly settingsService: SettingsService) {}

  private async getCredentials() {
    const token =
      await this.settingsService.getDecryptedSetting('vercel_api_token');
    const projectId =
      await this.settingsService.getDecryptedSetting('vercel_project_id');
    const teamId =
      await this.settingsService.getDecryptedSetting('vercel_team_id');

    if (!token || !projectId) {
      this.logger.warn('Vercel credentials not configured');
      return null;
    }
    return { token, projectId, teamId };
  }

  private getDateRange(period: '24h' | '7d' | '30d') {
    const to = new Date();
    const from = new Date();
    switch (period) {
      case '24h':
        from.setDate(to.getDate() - 1);
        break;
      case '7d':
        from.setDate(to.getDate() - 7);
        break;
      case '30d':
        from.setDate(to.getDate() - 30);
        break;
    }
    return { from: from.getTime(), to: to.getTime() };
  }

  async getAnalytics(period: '24h' | '7d' | '30d' = '7d') {
    const creds = await this.getCredentials();
    if (!creds) return null;

    const { from, to } = this.getDateRange(period);
    const teamQuery = creds.teamId ? `&teamId=${creds.teamId}` : '';

    try {
      const [statsRes, timeseriesRes] = await Promise.all([
        fetch(
          `https://vercel.com/api/web/insights/stats?projectId=${creds.projectId}&from=${from}&to=${to}${teamQuery}`,
          { headers: { Authorization: `Bearer ${creds.token}` } },
        ),
        fetch(
          `https://vercel.com/api/web/insights/timeseries?projectId=${creds.projectId}&from=${from}&to=${to}${teamQuery}`,
          { headers: { Authorization: `Bearer ${creds.token}` } },
        ),
      ]);

      if (!statsRes.ok || !timeseriesRes.ok) {
        throw new Error(
          `Vercel API error: stats=${statsRes.status}, timeseries=${timeseriesRes.status}`,
        );
      }

      const [stats, timeseries] = await Promise.all([
        statsRes.json(),
        timeseriesRes.json(),
      ]);

      return { stats, timeseries };
    } catch (error) {
      this.logger.error('Failed to fetch Vercel analytics', error);
      throw error;
    }
  }

  async getSpeedInsights(period: '24h' | '7d' | '30d' = '7d') {
    const creds = await this.getCredentials();
    if (!creds) return null;

    const { from, to } = this.getDateRange(period);
    const teamQuery = creds.teamId ? `&teamId=${creds.teamId}` : '';

    try {
      const res = await fetch(
        `https://vercel.com/api/speed-insights/timeseries?projectId=${creds.projectId}&from=${from}&to=${to}${teamQuery}`,
        { headers: { Authorization: `Bearer ${creds.token}` } },
      );

      if (!res.ok) {
        throw new Error(`Vercel Speed Insights API error: ${res.status}`);
      }

      return res.json();
    } catch (error) {
      this.logger.error('Failed to fetch Speed Insights', error);
      throw error;
    }
  }
}
