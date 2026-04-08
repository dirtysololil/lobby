import { Module } from '@nestjs/common';
import { CallsModule } from '../calls/calls.module';
import { MediaLibraryModule } from '../media-library/media-library.module';
import { QueueModule } from '../queue/queue.module';
import { StickersModule } from '../stickers/stickers.module';
import { DirectMessagesController } from './direct-messages.controller';
import { DirectMessagesService } from './direct-messages.service';
import { DmRetentionProcessor } from './dm-retention.processor';
import { DmRetentionScheduler } from './dm-retention.scheduler';
import { LinkUnfurlProcessor } from '../link-unfurl/link-unfurl.processor';
import { LinkUnfurlSweepService } from '../link-unfurl/link-unfurl-sweep.service';
import { LinkUnfurlService } from '../link-unfurl/link-unfurl.service';

@Module({
  imports: [CallsModule, StickersModule, MediaLibraryModule, QueueModule],
  controllers: [DirectMessagesController],
  providers: [
    DirectMessagesService,
    DmRetentionProcessor,
    DmRetentionScheduler,
    LinkUnfurlService,
    LinkUnfurlProcessor,
    LinkUnfurlSweepService,
  ],
  exports: [DirectMessagesService],
})
export class DirectMessagesModule {}
