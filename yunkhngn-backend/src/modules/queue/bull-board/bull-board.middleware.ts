import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { Queue } from 'bullmq';

export const BULL_BOARD_BASE_PATH = '/admin/queues';

export function createBullBoardRouter(queues: Queue[]) {
  const adapter = new ExpressAdapter();
  adapter.setBasePath(BULL_BOARD_BASE_PATH);

  createBullBoard({
    queues: queues.map((q) => new BullMQAdapter(q)),
    serverAdapter: adapter,
  });

  return adapter.getRouter();
}
