import { Injectable } from '@nestjs/common';
import { AccessToken } from 'livekit-server-sdk';
import { EnvService } from '../env/env.service';

@Injectable()
export class LivekitService {
  public constructor(private readonly envService: EnvService) {}

  public async issueParticipantToken(input: {
    userId: string;
    username: string;
    displayName: string;
    roomName: string;
    callId: string;
    scope: 'DM' | 'HUB_LOBBY';
    canPublishMedia: boolean;
  }): Promise<{ url: string; token: string; roomName: string }> {
    const env = this.envService.getValues();
    const token = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
      identity: `${input.callId}:${input.userId}`,
      name: input.displayName,
      ttl: env.LIVEKIT_TOKEN_TTL_MINUTES * 60,
      metadata: JSON.stringify({
        callId: input.callId,
        userId: input.userId,
        username: input.username,
        scope: input.scope,
      }),
      attributes: {
        callId: input.callId,
        userId: input.userId,
        username: input.username,
        scope: input.scope,
      },
    });

    token.addGrant({
      roomJoin: true,
      room: input.roomName,
      canPublish: input.canPublishMedia,
      canSubscribe: true,
      canPublishData: true,
    });

    return {
      url: env.LIVEKIT_URL,
      roomName: input.roomName,
      token: await token.toJwt(),
    };
  }
}
