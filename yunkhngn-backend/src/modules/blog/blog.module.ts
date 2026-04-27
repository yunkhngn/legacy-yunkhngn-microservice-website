import { Module } from '@nestjs/common';
import { BlogController } from './blog.controller';
import { BlogService } from './blog.service';
import { IBlogRepository } from './domain/blog.repository.interface';
import { PrismaBlogRepository } from './infrastructure/blog.repository';

import { NewsletterModule } from '../integrations/newsletter/newsletter.module';
import { PrismaModule } from '../../database/prisma/prisma.module';

@Module({
  imports: [PrismaModule, NewsletterModule],
  controllers: [BlogController],
  providers: [
    BlogService,
    {
      provide: IBlogRepository,
      useClass: PrismaBlogRepository,
    },
  ],
  exports: [BlogService],
})
export class BlogModule {}
