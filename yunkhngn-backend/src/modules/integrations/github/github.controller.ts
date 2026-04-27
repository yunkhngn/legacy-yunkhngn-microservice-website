import { Controller, Get, UseGuards } from '@nestjs/common';
import { GithubService } from './github.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { FirebaseAuthGuard, RolesGuard } from '../../../common/guards';
import { Roles } from '../../../common/decorators';

@ApiTags('Github')
@Controller('admin/github')
export class GithubController {
  constructor(private readonly githubService: GithubService) { }

  @Get('repos')
  @ApiOperation({ summary: 'Get public repositories' })
  getPublicRepos() {
    return this.githubService.getPublicRepos();
  }

  @Get('deployments')
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get deployment status (workflow runs)' })
  getDeployments() {
    return this.githubService.getWorkflowRuns();
  }

  @Get('latest-activity')
  @ApiOperation({ summary: 'Get latest public activity' })
  getLatestActivity() {
    return this.githubService.getLatestActivity();
  }
}
