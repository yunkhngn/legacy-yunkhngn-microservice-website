import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ShortlinkService } from './shortlink.service';
import { CreateShortlinkDto } from './dto/create-shortlink.dto';
import { UpdateShortlinkDto } from './dto/update-shortlink.dto';
import { FirebaseAuthGuard, RolesGuard } from '../../common/guards';
import { Roles } from '../../common/decorators';

@ApiTags('Shortlink')
@Controller('shortlinks')
export class ShortlinkController {
  constructor(private readonly shortlinkService: ShortlinkService) {}

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new shortlink' })
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('ADMIN')
  create(@Body() dto: CreateShortlinkDto) {
    return this.shortlinkService.create(dto);
  }

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all shortlinks (Admin only)' })
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('ADMIN')
  findAll() {
    return this.shortlinkService.findAll();
  }

  @Get('resolve/:code')
  @ApiOperation({ summary: 'Resolve a shortlink code to its destination URL' })
  resolve(@Param('code') code: string) {
    return this.shortlinkService.resolve(code);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a shortlink' })
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateShortlinkDto) {
    return this.shortlinkService.update(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a shortlink' })
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.shortlinkService.remove(id);
  }

  @Post('bulk/delete')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bulk delete shortlinks' })
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('ADMIN')
  bulkDelete(@Body() body: { ids: string[] }) {
    return this.shortlinkService.bulkDelete(body.ids);
  }

  @Post('bulk/status')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bulk update shortlinks status' })
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('ADMIN')
  bulkUpdateStatus(@Body() body: { ids: string[]; isActive: boolean }) {
    return this.shortlinkService.bulkUpdateStatus(body.ids, body.isActive);
  }
}
