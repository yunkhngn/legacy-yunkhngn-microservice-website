import { Module } from '@nestjs/common';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';
import { IProjectRepository } from './domain/project.repository.interface';
import { PrismaProjectRepository } from './infrastructure/project.repository';
import { PrismaModule } from '../../database/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ProjectController],
  providers: [
    ProjectService,
    {
      provide: IProjectRepository,
      useClass: PrismaProjectRepository,
    },
  ],
  exports: [ProjectService],
})
export class ProjectModule {}
