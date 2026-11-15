import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FirebaseAuthGuard } from '../../../common/guards';
import { RagSyncReindexService } from './rag-sync.reindex.service';

@ApiTags('Queues')
@Controller('queues/rag-sync')
export class RagSyncController {
  constructor(private readonly reindexService: RagSyncReindexService) {}

  @Post('reindex')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Enqueue all blog/project documents for RAG reindex' })
  @UseGuards(FirebaseAuthGuard)
  reindexAll() {
    return this.reindexService.enqueueAll();
  }
}
