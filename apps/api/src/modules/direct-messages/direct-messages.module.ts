import { Module } from '@nestjs/common';
import { DirectMessagesController } from './direct-messages.controller';
import { DirectMessagesService } from './direct-messages.service';
import { DmRetentionProcessor } from './dm-retention.processor';
import { DmRetentionScheduler } from './dm-retention.scheduler';

@Module({
  controllers: [DirectMessagesController],
  providers: [
    DirectMessagesService,
    DmRetentionProcessor,
    DmRetentionScheduler,
  ],
  exports: [DirectMessagesService],
})
export class DirectMessagesModule {}
