import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CallSignal,
  CallStateResponse,
  CallSummary,
  PublicUser,
  StartDmCallInput,
} from '@lobby/shared';
import {
  CallMode,
  CallParticipantState,
  CallScope,
  CallStatus,
  LobbyType,
  Prisma,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import type { RequestMetadata } from '../../common/interfaces/request-metadata.interface';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { publicUserSelect } from '../auth/auth.mapper';
import { EnvService } from '../env/env.service';
import { HubsService } from '../hubs/hubs.service';
import { QueueService } from '../queue/queue.service';
import { RelationshipsService } from '../relationships/relationships.service';
import {
  callSessionInclude,
  toCallSummary,
  type CallSessionRecord,
} from './calls.mapper';
import { CallsRealtimeService } from './calls-realtime.service';
import { LivekitService } from './livekit.service';

const dmConversationInclude = {
  participants: {
    include: {
      user: {
        select: publicUserSelect,
      },
    },
    orderBy: {
      joinedAt: 'asc',
    },
  },
} satisfies Prisma.DirectConversationInclude;

type DmConversationRecord = Prisma.DirectConversationGetPayload<{
  include: typeof dmConversationInclude;
}>;

const ACTIVE_CALL_STATUSES: CallStatus[] = [
  CallStatus.RINGING,
  CallStatus.ACCEPTED,
];

@Injectable()
export class CallsService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly relationshipsService: RelationshipsService,
    private readonly hubsService: HubsService,
    private readonly queueService: QueueService,
    private readonly livekitService: LivekitService,
    private readonly realtimeService: CallsRealtimeService,
    private readonly envService: EnvService,
  ) {}

  public async getDmCallState(
    viewerId: string,
    conversationId: string,
  ): Promise<CallStateResponse> {
    await this.assertDmConversationAccess(viewerId, conversationId);

    const calls = await this.prisma.callSession.findMany({
      where: {
        dmConversationId: conversationId,
      },
      include: callSessionInclude,
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
    });

    return {
      activeCall:
        calls.find((call) => ACTIVE_CALL_STATUSES.includes(call.status)) != null
          ? toCallSummary(
              calls.find((call) => ACTIVE_CALL_STATUSES.includes(call.status))!,
            )
          : null,
      history: calls.map((call) => toCallSummary(call)),
    };
  }

  public async getLobbyCallState(
    viewerId: string,
    hubId: string,
    lobbyId: string,
  ): Promise<CallStateResponse> {
    await this.assertLobbyCallAccess(viewerId, hubId, lobbyId);

    const calls = await this.prisma.callSession.findMany({
      where: {
        scope: CallScope.HUB_LOBBY,
        hubId,
        lobbyId,
      },
      include: callSessionInclude,
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
    });

    return {
      activeCall:
        calls.find((call) => ACTIVE_CALL_STATUSES.includes(call.status)) != null
          ? toCallSummary(
              calls.find((call) => ACTIVE_CALL_STATUSES.includes(call.status))!,
            )
          : null,
      history: calls.map((call) => toCallSummary(call)),
    };
  }

  public async startDmCall(
    actor: PublicUser,
    conversationId: string,
    input: StartDmCallInput,
    requestMetadata: RequestMetadata,
  ): Promise<CallSummary> {
    const conversation = await this.getDmConversationOrThrow(
      actor.id,
      conversationId,
    );
    const counterpart = conversation.participants.find(
      (participant) => participant.userId !== actor.id,
    );

    if (!counterpart) {
      throw new NotFoundException('Direct conversation counterpart not found');
    }

    await this.relationshipsService.assertInteractionAllowed(
      actor.id,
      counterpart.userId,
    );

    const existingCall = await this.prisma.callSession.findFirst({
      where: {
        dmConversationId: conversationId,
        status: {
          in: ACTIVE_CALL_STATUSES,
        },
      },
      include: callSessionInclude,
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (existingCall) {
      return toCallSummary(existingCall);
    }

    const now = new Date();
    const call = await this.prisma.callSession.create({
      data: {
        scope: CallScope.DM,
        mode: input.mode,
        status: CallStatus.RINGING,
        dmConversationId: conversationId,
        livekitRoomName: this.buildRoomName(CallScope.DM),
        initiatedByUserId: actor.id,
        participants: {
          create: [
            {
              userId: actor.id,
              state: CallParticipantState.JOINED,
              respondedAt: now,
              joinedAt: now,
            },
            {
              userId: counterpart.userId,
              state: CallParticipantState.INVITED,
            },
          ],
        },
      },
      include: callSessionInclude,
    });

    await this.queueService.scheduleCallTimeout(
      call.id,
      new Date(
        now.getTime() +
          this.envService.getValues().CALL_RING_TIMEOUT_SECONDS * 1_000,
      ),
    );

    await this.auditService.write({
      action: 'calls.dm.start',
      entityType: 'CallSession',
      entityId: call.id,
      actorUserId: actor.id,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      metadata: {
        conversationId,
        mode: call.mode,
      },
    });

    this.emitCallSignal('CALL_CREATED', call);

    return toCallSummary(call);
  }

  public async startLobbyCall(
    actor: PublicUser,
    hubId: string,
    lobbyId: string,
    requestMetadata: RequestMetadata,
  ): Promise<CallSummary> {
    await this.assertLobbyCallAccess(actor.id, hubId, lobbyId);

    const existingCall = await this.prisma.callSession.findFirst({
      where: {
        scope: CallScope.HUB_LOBBY,
        hubId,
        lobbyId,
        status: {
          in: ACTIVE_CALL_STATUSES,
        },
      },
      include: callSessionInclude,
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (existingCall) {
      return toCallSummary(existingCall);
    }

    const now = new Date();
    const call = await this.prisma.callSession.create({
      data: {
        scope: CallScope.HUB_LOBBY,
        mode: CallMode.AUDIO,
        status: CallStatus.ACCEPTED,
        acceptedAt: now,
        hubId,
        lobbyId,
        livekitRoomName: this.buildRoomName(CallScope.HUB_LOBBY),
        initiatedByUserId: actor.id,
        participants: {
          create: {
            userId: actor.id,
            state: CallParticipantState.JOINED,
            respondedAt: now,
            joinedAt: now,
          },
        },
      },
      include: callSessionInclude,
    });

    await this.auditService.write({
      action: 'calls.lobby.start',
      entityType: 'CallSession',
      entityId: call.id,
      actorUserId: actor.id,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      metadata: {
        hubId,
        lobbyId,
      },
    });

    this.emitCallSignal('CALL_CREATED', call);

    return toCallSummary(call);
  }

  public async acceptCall(
    actor: PublicUser,
    callId: string,
    requestMetadata: RequestMetadata,
  ): Promise<CallSummary> {
    const call = await this.getCallOrThrow(callId);
    const participant = this.getParticipantOrThrow(call, actor.id);

    if (call.scope !== CallScope.DM) {
      throw new ConflictException('Accept is available only for direct calls');
    }

    if (call.status !== CallStatus.RINGING) {
      throw new ConflictException('Call is no longer ringing');
    }

    if (call.initiatedByUserId === actor.id) {
      throw new ConflictException('Caller cannot accept own ringing call');
    }

    const counterpart = call.participants.find(
      (item) => item.userId !== actor.id,
    );

    if (!counterpart) {
      throw new NotFoundException('Call counterpart not found');
    }

    await this.relationshipsService.assertInteractionAllowed(
      actor.id,
      counterpart.userId,
    );

    if (
      participant.state === CallParticipantState.DECLINED ||
      participant.state === CallParticipantState.MISSED
    ) {
      throw new ConflictException('Call participant can no longer accept');
    }

    const now = new Date();
    const updatedCall = await this.prisma.callSession.update({
      where: {
        id: call.id,
      },
      data: {
        status: CallStatus.ACCEPTED,
        acceptedAt: now,
        participants: {
          update: {
            where: {
              callSessionId_userId: {
                callSessionId: call.id,
                userId: actor.id,
              },
            },
            data: {
              state: CallParticipantState.ACCEPTED,
              respondedAt: now,
            },
          },
        },
      },
      include: callSessionInclude,
    });

    await this.auditService.write({
      action: 'calls.accept',
      entityType: 'CallSession',
      entityId: updatedCall.id,
      actorUserId: actor.id,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      metadata: {
        scope: updatedCall.scope,
      },
    });

    this.emitCallSignal('CALL_UPDATED', updatedCall);

    return toCallSummary(updatedCall);
  }

  public async declineCall(
    actor: PublicUser,
    callId: string,
    requestMetadata: RequestMetadata,
  ): Promise<CallSummary> {
    const call = await this.getCallOrThrow(callId);
    const participant = this.getParticipantOrThrow(call, actor.id);

    if (call.scope !== CallScope.DM) {
      throw new ConflictException('Decline is available only for direct calls');
    }

    if (call.status !== CallStatus.RINGING) {
      throw new ConflictException('Call is no longer ringing');
    }

    if (call.initiatedByUserId === actor.id) {
      throw new ConflictException('Caller cannot decline own ringing call');
    }

    if (participant.state === CallParticipantState.DECLINED) {
      return toCallSummary(call);
    }

    const now = new Date();
    const updatedCall = await this.prisma.callSession.update({
      where: {
        id: call.id,
      },
      data: {
        status: CallStatus.DECLINED,
        endedAt: now,
        endedByUserId: actor.id,
        participants: {
          update: {
            where: {
              callSessionId_userId: {
                callSessionId: call.id,
                userId: actor.id,
              },
            },
            data: {
              state: CallParticipantState.DECLINED,
              respondedAt: now,
              leftAt: now,
            },
          },
        },
      },
      include: callSessionInclude,
    });

    await this.auditService.write({
      action: 'calls.decline',
      entityType: 'CallSession',
      entityId: updatedCall.id,
      actorUserId: actor.id,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      metadata: {
        scope: updatedCall.scope,
      },
    });

    this.emitCallSignal('CALL_ENDED', updatedCall);

    return toCallSummary(updatedCall);
  }

  public async endCall(
    actor: PublicUser,
    callId: string,
    requestMetadata: RequestMetadata,
  ): Promise<CallSummary> {
    const call = await this.getCallOrThrow(callId);
    this.getParticipantOrThrow(call, actor.id);

    if (!ACTIVE_CALL_STATUSES.includes(call.status)) {
      return toCallSummary(call);
    }

    const now = new Date();

    if (call.scope === CallScope.DM) {
      const updatedCall = await this.prisma.callSession.update({
        where: {
          id: call.id,
        },
        data: {
          status: CallStatus.ENDED,
          endedAt: now,
          endedByUserId: actor.id,
          participants: {
            updateMany: {
              where: {
                callSessionId: call.id,
              },
              data: {
                leftAt: now,
              },
            },
          },
        },
        include: callSessionInclude,
      });

      await this.auditService.write({
        action: 'calls.end',
        entityType: 'CallSession',
        entityId: updatedCall.id,
        actorUserId: actor.id,
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
        metadata: {
          scope: updatedCall.scope,
        },
      });

      this.emitCallSignal('CALL_ENDED', updatedCall);

      return toCallSummary(updatedCall);
    }

    await this.prisma.callParticipant.update({
      where: {
        callSessionId_userId: {
          callSessionId: call.id,
          userId: actor.id,
        },
      },
      data: {
        state: CallParticipantState.LEFT,
        leftAt: now,
      },
    });

    const joinedParticipants = await this.prisma.callParticipant.count({
      where: {
        callSessionId: call.id,
        state: CallParticipantState.JOINED,
        leftAt: null,
      },
    });

    const updatedCall = await this.prisma.callSession.update({
      where: {
        id: call.id,
      },
      data:
        joinedParticipants === 0
          ? {
              status: CallStatus.ENDED,
              endedAt: now,
              endedByUserId: actor.id,
            }
          : {},
      include: callSessionInclude,
    });

    await this.auditService.write({
      action: 'calls.end',
      entityType: 'CallSession',
      entityId: updatedCall.id,
      actorUserId: actor.id,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      metadata: {
        scope: updatedCall.scope,
      },
    });

    this.emitCallSignal(
      joinedParticipants === 0 ? 'CALL_ENDED' : 'CALL_UPDATED',
      updatedCall,
    );

    return toCallSummary(updatedCall);
  }

  public async issueCallToken(
    actor: PublicUser,
    callId: string,
    requestMetadata: RequestMetadata,
  ): Promise<{
    call: CallSummary;
    connection: {
      callId: string;
      url: string;
      roomName: string;
      token: string;
      canPublishMedia: boolean;
    };
  }> {
    const call = await this.getCallOrThrow(callId);

    if (!ACTIVE_CALL_STATUSES.includes(call.status)) {
      throw new ConflictException('Call is no longer active');
    }

    let canPublishMedia = true;
    let updatedCall = call;

    if (call.scope === CallScope.DM) {
      const participant = this.getParticipantOrThrow(call, actor.id);
      const counterpart = call.participants.find(
        (item) => item.userId !== actor.id,
      );

      if (!counterpart) {
        throw new NotFoundException('Call counterpart not found');
      }

      await this.relationshipsService.assertInteractionAllowed(
        actor.id,
        counterpart.userId,
      );

      if (call.initiatedByUserId !== actor.id) {
        updatedCall = await this.prisma.callSession.update({
          where: {
            id: call.id,
          },
          data: {
            status: CallStatus.ACCEPTED,
            acceptedAt: call.acceptedAt ?? new Date(),
            participants: {
              update: {
                where: {
                  callSessionId_userId: {
                    callSessionId: call.id,
                    userId: actor.id,
                  },
                },
                data: {
                  state: CallParticipantState.JOINED,
                  respondedAt: participant.respondedAt ?? new Date(),
                  joinedAt: participant.joinedAt ?? new Date(),
                  leftAt: null,
                },
              },
            },
          },
          include: callSessionInclude,
        });
      }
    } else {
      await this.assertLobbyCallAccess(actor.id, call.hubId!, call.lobbyId!);
      await this.assertNoBlockedActiveParticipants(call, actor.id);
      canPublishMedia = !(await this.isHubMuted(call.hubId!, actor.id));

      await this.prisma.callParticipant.upsert({
        where: {
          callSessionId_userId: {
            callSessionId: call.id,
            userId: actor.id,
          },
        },
        create: {
          callSessionId: call.id,
          userId: actor.id,
          state: CallParticipantState.JOINED,
          respondedAt: new Date(),
          joinedAt: new Date(),
        },
        update: {
          state: CallParticipantState.JOINED,
          respondedAt: new Date(),
          joinedAt: new Date(),
          leftAt: null,
        },
      });

      updatedCall = await this.prisma.callSession.findUniqueOrThrow({
        where: {
          id: call.id,
        },
        include: callSessionInclude,
      });
    }

    await this.auditService.write({
      action: 'calls.token.issue',
      entityType: 'CallSession',
      entityId: updatedCall.id,
      actorUserId: actor.id,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      metadata: {
        scope: updatedCall.scope,
        canPublishMedia,
      },
    });

    if (
      updatedCall.participants.find(
        (participant) =>
          participant.userId === actor.id &&
          participant.state === CallParticipantState.JOINED,
      )
    ) {
      this.emitCallSignal('CALL_UPDATED', updatedCall);
    }

    const connection = await this.livekitService.issueParticipantToken({
      callId: updatedCall.id,
      scope: updatedCall.scope,
      roomName: updatedCall.livekitRoomName,
      userId: actor.id,
      username: actor.username,
      displayName: actor.profile.displayName,
      canPublishMedia,
    });

    return {
      call: toCallSummary(updatedCall),
      connection: {
        callId: updatedCall.id,
        url: connection.url,
        roomName: connection.roomName,
        token: connection.token,
        canPublishMedia,
      },
    };
  }

  public async expireRingingCall(callId: string): Promise<void> {
    const call = await this.prisma.callSession.findUnique({
      where: {
        id: callId,
      },
      include: callSessionInclude,
    });

    if (!call || call.status !== CallStatus.RINGING) {
      return;
    }

    const missedParticipant = call.participants.find(
      (participant) => participant.userId !== call.initiatedByUserId,
    );

    const updatedCall = await this.prisma.callSession.update({
      where: {
        id: call.id,
      },
      data: {
        status: CallStatus.MISSED,
        endedAt: new Date(),
        participants: missedParticipant
          ? {
              update: {
                where: {
                  callSessionId_userId: {
                    callSessionId: call.id,
                    userId: missedParticipant.userId,
                  },
                },
                data: {
                  state: CallParticipantState.MISSED,
                  respondedAt: new Date(),
                },
              },
            }
          : undefined,
      },
      include: callSessionInclude,
    });

    await this.auditService.write({
      action: 'calls.timeout.missed',
      entityType: 'CallSession',
      entityId: updatedCall.id,
      actorUserId: null,
      metadata: {
        scope: updatedCall.scope,
      },
    });

    this.emitCallSignal('CALL_MISSED', updatedCall);
  }

  public async assertDmConversationAccess(
    viewerId: string,
    conversationId: string,
  ): Promise<void> {
    await this.getDmConversationOrThrow(viewerId, conversationId);
  }

  public async assertLobbyCallAccess(
    viewerId: string,
    hubId: string,
    lobbyId: string,
  ): Promise<void> {
    const lobby = await this.hubsService.getAccessibleLobbyOrThrow(
      viewerId,
      hubId,
      lobbyId,
    );

    if (lobby.type !== LobbyType.VOICE) {
      throw new ConflictException(
        'Call access is allowed only for voice lobby',
      );
    }
  }

  private async getDmConversationOrThrow(
    viewerId: string,
    conversationId: string,
  ): Promise<DmConversationRecord> {
    const conversation = await this.prisma.directConversation.findFirst({
      where: {
        id: conversationId,
        participants: {
          some: {
            userId: viewerId,
          },
        },
      },
      include: dmConversationInclude,
    });

    if (!conversation) {
      throw new NotFoundException('Direct conversation not found');
    }

    return conversation;
  }

  private async getCallOrThrow(callId: string): Promise<CallSessionRecord> {
    const call = await this.prisma.callSession.findUnique({
      where: {
        id: callId,
      },
      include: callSessionInclude,
    });

    if (!call) {
      throw new NotFoundException('Call not found');
    }

    return call;
  }

  private getParticipantOrThrow(call: CallSessionRecord, userId: string) {
    const participant = call.participants.find(
      (item) => item.userId === userId,
    );

    if (!participant) {
      throw new ForbiddenException('Call access denied');
    }

    return participant;
  }

  private async assertNoBlockedActiveParticipants(
    call: CallSessionRecord,
    viewerId: string,
  ): Promise<void> {
    const otherJoinedUserIds = call.participants
      .filter(
        (participant) =>
          participant.userId !== viewerId &&
          participant.state === CallParticipantState.JOINED &&
          !participant.leftAt,
      )
      .map((participant) => participant.userId);

    if (otherJoinedUserIds.length === 0) {
      return;
    }

    const blockingRelation = await this.prisma.block.findFirst({
      where: {
        OR: otherJoinedUserIds.flatMap((userId) => [
          {
            blockerId: viewerId,
            blockedId: userId,
          },
          {
            blockerId: userId,
            blockedId: viewerId,
          },
        ]),
      },
      select: {
        id: true,
      },
    });

    if (blockingRelation) {
      throw new ForbiddenException(
        'Call access denied because one of the participants is blocked',
      );
    }
  }

  private async isHubMuted(hubId: string, userId: string): Promise<boolean> {
    const mute = await this.prisma.hubMute.findUnique({
      where: {
        hubId_userId: {
          hubId,
          userId,
        },
      },
      select: {
        id: true,
        expiresAt: true,
      },
    });

    if (!mute) {
      return false;
    }

    if (!mute.expiresAt || mute.expiresAt > new Date()) {
      return true;
    }

    await this.prisma.hubMute.delete({
      where: {
        id: mute.id,
      },
    });

    return false;
  }

  private buildRoomName(scope: CallScope): string {
    return `lobby_${scope.toLowerCase()}_${randomUUID().replace(/-/g, '')}`;
  }

  private emitCallSignal(
    event: CallSignal['event'],
    call: CallSessionRecord,
  ): void {
    const payload: CallSignal = {
      event,
      call: toCallSummary(call),
    };

    if (call.scope === CallScope.DM && call.dmConversationId) {
      this.realtimeService.emitToUsers(
        call.participants.map((participant) => participant.userId),
        payload,
      );
      this.realtimeService.emitToDm(call.dmConversationId, payload);
      return;
    }

    if (call.scope === CallScope.HUB_LOBBY && call.lobbyId) {
      this.realtimeService.emitToUsers(
        call.participants.map((participant) => participant.userId),
        payload,
      );
      this.realtimeService.emitToLobby(call.lobbyId, payload);
    }
  }
}
