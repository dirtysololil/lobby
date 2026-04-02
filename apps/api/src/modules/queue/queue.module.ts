import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { EnvService } from '../env/env.service';
import {
  CALL_TIMEOUT_QUEUE,
  DM_RETENTION_QUEUE,
  SESSION_EXPIRY_QUEUE,
} from './queue.constants';
import { QueueService } from './queue.service';
import { getBullConnection } from './queue.utils';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [EnvService],
      useFactory: (envService: EnvService) => {
        const env = envService.getValues();

        return {
          connection: getBullConnection(env.REDIS_URL),
          prefix: env.BULLMQ_PREFIX,
        };
      },
    }),
    BullModule.registerQueue({
      name: SESSION_EXPIRY_QUEUE,
    }),
    BullModule.registerQueue({
      name: DM_RETENTION_QUEUE,
    }),
    BullModule.registerQueue({
      name: CALL_TIMEOUT_QUEUE,
    }),
  ],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
