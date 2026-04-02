import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { DM_RETENTION_QUEUE } from '../queue/queue.constants';
import { DirectMessagesService } from './direct-messages.service';

@Processor(DM_RETENTION_QUEUE)
export class DmRetentionProcessor extends WorkerHost {
  public constructor(
    private readonly directMessagesService: DirectMessagesService,
  ) {
    super();
  }

  public async process(job: Job): Promise<void> {
    if (job.name === 'sweep-dm-retention') {
      await this.directMessagesService.cleanupExpiredMessages();
    }
  }
}
