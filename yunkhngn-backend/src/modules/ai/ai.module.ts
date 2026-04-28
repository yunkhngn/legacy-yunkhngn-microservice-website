import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { ConfigModule } from '@nestjs/config';
import { SettingsModule } from '../settings/settings.module';
import { BlogModule } from '../blog/blog.module';
import { ProjectModule } from '../project/project.module';
import { GalleryModule } from '../gallery/gallery.module';

@Module({
  imports: [
    ConfigModule,
    BlogModule,
    ProjectModule,
    GalleryModule,
  ],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
