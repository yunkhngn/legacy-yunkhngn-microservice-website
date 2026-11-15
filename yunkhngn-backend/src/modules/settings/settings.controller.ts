import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { CreateSettingsDto } from './dto/create-settings.dto';
import { FirebaseAuthGuard } from '../../common/guards';
import { CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';

@ApiTags('Settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @UseInterceptors(CacheInterceptor)
  @CacheKey('public_settings')
  @CacheTTL(600) // Cache for 10 minutes
  @ApiOperation({ summary: 'Get public settings' })
  getSettings() {
    return this.settingsService.getSettings();
  }

  @Get('admin')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get all settings including sensitive ones (Admin only)',
  })
  @UseGuards(FirebaseAuthGuard)
  getAdminSettings() {
    return this.settingsService.getAdminSettings();
  }

  @Get('admin/grouped')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all settings grouped by tab (Admin only)' })
  @UseGuards(FirebaseAuthGuard)
  getGroupedSettings() {
    return this.settingsService.getGroupedSettings();
  }

  // --- Gemini API Keys Pool Management ---
  // These must be defined BEFORE the :id param routes to avoid route conflicts

  @Get('api-keys')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all Gemini API keys (masked)' })
  @UseGuards(FirebaseAuthGuard)
  listApiKeys() {
    return this.settingsService.listApiKeys();
  }

  @Post('api-keys/add')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a Gemini API key to the pool' })
  @UseGuards(FirebaseAuthGuard)
  addApiKey(@Body('key') key: string) {
    return this.settingsService.addApiKey(key);
  }

  @Delete('api-keys/:index')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove a Gemini API key from the pool by index' })
  @UseGuards(FirebaseAuthGuard)
  removeApiKey(@Param('index') index: string) {
    return this.settingsService.removeApiKey(+index);
  }

  // --- Generic Settings CRUD ---

  @Patch()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update system settings' })
  @UseGuards(FirebaseAuthGuard)
  update(@Body() updateSettingsDto: UpdateSettingsDto) {
    return this.settingsService.update(updateSettingsDto);
  }

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new setting' })
  @UseGuards(FirebaseAuthGuard)
  create(@Body() createSettingsDto: CreateSettingsDto) {
    return this.settingsService.create(
      createSettingsDto.settingTitle,
      createSettingsDto.content,
      createSettingsDto.group,
      createSettingsDto.isSensitive,
    );
  }

  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a specific setting entry' })
  @UseGuards(FirebaseAuthGuard)
  remove(@Param('id') id: string) {
    return this.settingsService.delete(+id);
  }
}
