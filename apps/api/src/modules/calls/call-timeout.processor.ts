import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { CALL_TIMEOUT_QUEUE } from '../queue/queue.constants';
import { CallsService } from './calls.service';

@Processor(CALL_TIMEOUT_QUEUE)
export class CallTimeoutProcessor extends WorkerHost {
  public constructor(private readonly callsService: CallsService) {
    super();
  }

  public async process(job: Job<{ callId: string }>): Promise<void> {
    if (job.name === 'expire-ringing-call') {
      await this.callsService.expireRingingCall(job.data.callId);
    }
  }
}
