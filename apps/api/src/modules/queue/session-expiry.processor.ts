import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { SessionService } from '../auth/session.service';
import { SESSION_EXPIRY_QUEUE } from './queue.constants';

@Processor(SESSION_EXPIRY_QUEUE)
export class SessionExpiryProcessor extends WorkerHost {
  public constructor(private readonly sessionService: SessionService) {
    super();
  }

  public async process(job: Job<{ sessionId: string }>): Promise<void> {
    await this.sessionService.revokeExpiredSessionById(job.data.sessionId);
  }
}
