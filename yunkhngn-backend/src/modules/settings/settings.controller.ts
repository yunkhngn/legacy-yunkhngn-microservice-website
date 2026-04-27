import {
  Controller,
  Get,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { FirebaseAuthGuard } from '../../common/guards';

@ApiTags('Settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
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

  @Patch()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update system settings' })
  @UseGuards(FirebaseAuthGuard)
  update(@Body() updateSettingsDto: UpdateSettingsDto) {
    return this.settingsService.update(updateSettingsDto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a specific setting entry' })
  @UseGuards(FirebaseAuthGuard)
  remove(@Param('id') id: string) {
    return this.settingsService.delete(+id);
  }
}
