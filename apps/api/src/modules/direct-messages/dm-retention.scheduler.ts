import { Injectable, OnModuleInit } from '@nestjs/common';
import { DirectMessagesService } from './direct-messages.service';

@Injectable()
export class DmRetentionScheduler implements OnModuleInit {
  public constructor(
    private readonly directMessagesService: DirectMessagesService,
  ) {}

  public async onModuleInit(): Promise<void> {
    await this.directMessagesService.ensureRetentionSweepJob();
  }
}
