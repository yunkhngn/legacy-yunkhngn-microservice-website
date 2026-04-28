import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SettingsService } from '../../settings/settings.service';

@Injectable()
export class GithubService {
  private octokit: any;
  /** Cache key = token string or '__public__' so DB/env token updates refresh the client */
  private clientCacheKey: string | null = null;
  private readonly logger = new Logger(GithubService.name);

  constructor(
    private configService: ConfigService,
    private settingsService: SettingsService,
  ) {}

  private async resolveToken(): Promise<string> {
    return (
      (await this.settingsService.getDecryptedSetting('github_api_key')) ||
      this.configService.get<string>('GITHUB_API_KEY') ||
      ''
    );
  }

  /**
   * Returns an Octokit instance. Uses token from DB/env on each call (cached per token value).
   * Without a token, uses unauthenticated client (stricter rate limits; OK for public repo lists).
   */
  private async getOctokit(): Promise<any | null> {
    const token = await this.resolveToken();
    const cacheKey = token || '__public__';
    if (this.octokit && this.clientCacheKey === cacheKey) {
      return this.octokit;
    }
    try {
      const { Octokit } = await eval('import("octokit")');
      this.octokit = token ? new Octokit({ auth: token }) : new Octokit();
      this.clientCacheKey = cacheKey;
      if (!token) {
        this.logger.debug(
          'GitHub: no API token; using unauthenticated requests (lower rate limits).',
        );
      }
    } catch (error) {
      this.logger.error('Failed to load Octokit', error);
      this.octokit = null;
      this.clientCacheKey = null;
      return null;
    }
    return this.octokit;
  }

  private async getUsername() {
    return (
      (await this.settingsService.getDecryptedSetting('github_username')) ||
      this.configService.get<string>('GITHUB_USERNAME')
    );
  }

  private async getRepoName() {
    return (
      (await this.settingsService.getDecryptedSetting('github_repo_name')) ||
      this.configService.get<string>('GITHUB_REPO_NAME')
    );
  }

  async getPublicRepos() {
    const username = await this.getUsername();
    if (!username) {
      this.logger.warn(
        'GitHub username not configured (settings github_username or GITHUB_USERNAME). Cannot list repos.',
      );
      return [];
    }
    const octokit = await this.getOctokit();
    if (!octokit) return [];
    try {
      const { data } = await octokit.request(
        'GET /users/{username}/repos',
        {
          username: username,
          sort: 'updated',
          per_page: 10,
          type: 'public',
        },
      );
      return data;
    } catch (error) {
      this.logger.error('Failed to fetch public repos', error);
      return [];
    }
  }

  async getWorkflowRuns() {
    const username = await this.getUsername();
    const repoName = await this.getRepoName();

    const octokit = await this.getOctokit();
    if (!octokit || !username || !repoName) return [];
    const token = await this.resolveToken();
    if (!token) {
      this.logger.warn(
        'GitHub Actions workflows require an API token with repo scope.',
      );
      return [];
    }
    try {
      const { data } = await octokit.request(
        'GET /repos/{owner}/{repo}/actions/runs',
        {
          owner: username,
          repo: repoName,
          per_page: 5,
        },
      );
      return data.workflow_runs.map((run) => ({
        id: run.id,
        name: run.name,
        status: run.status,
        conclusion: run.conclusion,
        created_at: run.created_at,
        updated_at: run.updated_at,
        html_url: run.html_url,
        run_number: run.run_number,
        display_title: run.display_title,
        actor: {
          login: run.actor?.login,
          avatar_url: run.actor?.avatar_url,
        },
        duration:
          run.updated_at && run.created_at
            ? new Date(run.updated_at).getTime() -
              new Date(run.created_at).getTime()
            : 0,
      }));
    } catch (error) {
      if (error.status === 404) {
        this.logger.warn(
          `Repository ${username}/${repoName} not found or token lacks permissions. Check GITHUB_REPO_NAME and token scopes.`,
        );
      } else {
        this.logger.error('Failed to fetch workflow runs', error);
      }
      return [];
    }
  }

  async getLatestActivity() {
    const username = await this.getUsername();
    if (!username) return null;

    const octokit = await this.getOctokit();
    if (!octokit) return null;

    try {
      const { data } = await octokit.request(
        'GET /users/{username}/events',
        {
          username,
          per_page: 10,
        },
      );

      const relevantEvent = data.find((e) =>
        [
          'PushEvent',
          'PullRequestEvent',
          'WatchEvent',
          'CreateEvent',
          'IssuesEvent',
        ].includes(e.type),
      );

      if (!relevantEvent) return null;

      const isPrivate = !relevantEvent.public;

      return {
        type: relevantEvent.type,
        repo: isPrivate ? 'Private Repository' : relevantEvent.repo.name,
        isPrivate,
        timestamp: relevantEvent.created_at,
        url: isPrivate ? null : `https://github.com/${relevantEvent.repo.name}`,
      };
    } catch (error) {
      this.logger.error('Failed to fetch user events', error);
      return null;
    }
  }
}
