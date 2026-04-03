import { Module } from '@nestjs/common';
import { CallTimeoutProcessor } from './call-timeout.processor';
import { CallsController } from './calls.controller';
import { CallsGateway } from './calls.gateway';
import { CallsRealtimeService } from './calls-realtime.service';
import { CallsService } from './calls.service';
import { LivekitService } from './livekit.service';

@Module({
  controllers: [CallsController],
  providers: [
    CallsService,
    CallsRealtimeService,
    CallsGateway,
    LivekitService,
    CallTimeoutProcessor,
  ],
  exports: [CallsService, CallsRealtimeService],
})
export class CallsModule {}
