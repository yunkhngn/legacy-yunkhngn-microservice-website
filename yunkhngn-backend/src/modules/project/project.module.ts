import { Module } from '@nestjs/common';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';
import { IProjectRepository } from './domain/project.repository.interface';
import { PrismaProjectRepository } from './infrastructure/project.repository';
import { PrismaModule } from '../../database/prisma/prisma.module';
import { AiModule } from '../ai/ai.module';
import { CloudinaryModule } from '../integrations/cloudinary/cloudinary.module';

@Module({
  imports: [PrismaModule, AiModule, CloudinaryModule],
  controllers: [ProjectController],
  providers: [
    ProjectService,
    {
      provide: IProjectRepository,
      useClass: PrismaProjectRepository,
    },
  ],
  exports: [ProjectService, IProjectRepository],
})
export class ProjectModule {}
