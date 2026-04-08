import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { DirectMessagesService } from '../direct-messages/direct-messages.service';
import { DM_LINK_UNFURL_QUEUE } from '../queue/queue.constants';
import { LinkUnfurlService } from './link-unfurl.service';

@Processor(DM_LINK_UNFURL_QUEUE)
export class LinkUnfurlProcessor extends WorkerHost {
  private readonly logger = new Logger(LinkUnfurlProcessor.name);

  public constructor(
    private readonly linkUnfurlService: LinkUnfurlService,
    private readonly directMessagesService: DirectMessagesService,
  ) {
    super();
  }

  public async process(job: Job<{ messageId: string }>): Promise<void> {
    if (job.name !== 'unfurl-dm-link') {
      return;
    }

    this.logger.log(`Processing DM link unfurl for message ${job.data.messageId}`);

    const didChange = await this.linkUnfurlService.processMessage(
      job.data.messageId,
    );

    if (didChange) {
      await this.directMessagesService.emitMessageUpdatedSignal(
        job.data.messageId,
      );
      this.logger.log(
        `Completed DM link unfurl for message ${job.data.messageId}`,
      );
    }
  }
}
