import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { DirectMessagesService } from '../direct-messages/direct-messages.service';
import { LinkUnfurlService } from './link-unfurl.service';

const sweepIntervalMs = 15_000;
const stalePendingAgeMs = 15_000;

@Injectable()
export class LinkUnfurlSweepService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LinkUnfurlSweepService.name);
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  public constructor(
    private readonly linkUnfurlService: LinkUnfurlService,
    private readonly directMessagesService: DirectMessagesService,
  ) {}

  public onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.sweep();
    }, sweepIntervalMs);
    this.timer.unref?.();
  }

  public onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async sweep(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    try {
      const messageIds = await this.linkUnfurlService.findStalePendingMessageIds(
        stalePendingAgeMs,
      );

      for (const messageId of messageIds) {
        const didChange = await this.linkUnfurlService.processMessage(messageId);

        if (didChange) {
          await this.directMessagesService.emitMessageUpdatedSignal(messageId);
        }
      }
    } catch (error) {
      this.logger.warn(
        `Failed to sweep stale DM unfurl jobs: ${
          error instanceof Error ? error.message : 'UNKNOWN_ERROR'
        }`,
      );
    } finally {
      this.isRunning = false;
    }
  }
}
