import { Module } from '@nestjs/common';
import { StickersModule } from '../stickers/stickers.module';
import { MediaLibraryController } from './media-library.controller';
import { MediaLibraryService } from './media-library.service';

@Module({
  imports: [StickersModule],
  controllers: [MediaLibraryController],
  providers: [MediaLibraryService],
  exports: [MediaLibraryService],
})
export class MediaLibraryModule {}
