import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  CALL_TIMEOUT_QUEUE,
  DM_RETENTION_QUEUE,
  SESSION_EXPIRY_QUEUE,
} from './queue.constants';

@Injectable()
export class QueueService {
  public constructor(
    @InjectQueue(SESSION_EXPIRY_QUEUE)
    private readonly sessionExpiryQueue: Queue,
    @InjectQueue(DM_RETENTION_QUEUE)
    private readonly dmRetentionQueue: Queue,
    @InjectQueue(CALL_TIMEOUT_QUEUE)
    private readonly callTimeoutQueue: Queue,
  ) {}

  public async scheduleSessionExpiry(
    sessionId: string,
    expiresAt: Date,
  ): Promise<void> {
    const delay = Math.max(0, expiresAt.getTime() - Date.now());

    await this.sessionExpiryQueue.add(
      'revoke-expired-session',
      {
        sessionId,
      },
      {
        jobId: sessionId,
        delay,
        removeOnComplete: 1000,
        removeOnFail: 1000,
      },
    );
  }

  public async ensureDmRetentionSweepJob(): Promise<void> {
    await this.dmRetentionQueue.add(
      'sweep-dm-retention',
      {},
      {
        jobId: 'dm-retention-sweep',
        repeat: {
          every: 15 * 60 * 1_000,
        },
        removeOnComplete: 1000,
        removeOnFail: 1000,
      },
    );
  }

  public async scheduleCallTimeout(
    callId: string,
    executeAt: Date,
  ): Promise<void> {
    const delay = Math.max(0, executeAt.getTime() - Date.now());

    await this.callTimeoutQueue.add(
      'expire-ringing-call',
      {
        callId,
      },
      {
        jobId: `call-timeout:${callId}`,
        delay,
        removeOnComplete: 1000,
        removeOnFail: 1000,
      },
    );
  }
}
