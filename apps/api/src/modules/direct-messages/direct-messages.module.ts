import { Module } from '@nestjs/common';
import { CallsModule } from '../calls/calls.module';
import { MediaLibraryModule } from '../media-library/media-library.module';
import { StickersModule } from '../stickers/stickers.module';
import { DirectMessagesController } from './direct-messages.controller';
import { DirectMessagesService } from './direct-messages.service';
import { DmRetentionProcessor } from './dm-retention.processor';
import { DmRetentionScheduler } from './dm-retention.scheduler';

@Module({
  imports: [CallsModule, StickersModule, MediaLibraryModule],
  controllers: [DirectMessagesController],
  providers: [
    DirectMessagesService,
    DmRetentionProcessor,
    DmRetentionScheduler,
  ],
  exports: [DirectMessagesService],
})
export class DirectMessagesModule {}
