import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreateDirectMessageInput,
  DirectConversationDetail,
  DirectConversationSummary,
  DmSignal,
  PublicUser,
  UpdateDmSettingsInput,
} from '@lobby/shared';
import { DmRetentionMode, Prisma } from '@prisma/client';
import type { RequestMetadata } from '../../common/interfaces/request-metadata.interface';
import { buildUserPairKey } from '../../common/utils/user-pair-key.util';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { publicUserSelect } from '../auth/auth.mapper';
import { CallsRealtimeService } from '../calls/calls-realtime.service';
import { QueueService } from '../queue/queue.service';
import { RelationshipsService } from '../relationships/relationships.service';
import {
  toDirectConversationDetail,
  toDirectConversationSummary,
  toDirectMessage,
  type MessageWithAuthor,
  type ParticipantWithUser,
} from './direct-messages.mapper';

const directMessageWithAuthorInclude = {
  author: {
    select: publicUserSelect,
  },
} satisfies Prisma.DirectMessageInclude;

const DM_DELETE_WINDOW_MS = 60 * 60 * 1_000;

const participantWithUserInclude = {
  user: {
    select: publicUserSelect,
  },
} satisfies Prisma.DirectConversationParticipantInclude;

const conversationSummaryInclude = {
  participants: {
    include: participantWithUserInclude,
  },
  messages: {
    where: {
      deletedAt: null,
    },
    include: directMessageWithAuthorInclude,
    orderBy: {
      createdAt: 'desc',
    },
    take: 1,
  },
} satisfies Prisma.DirectConversationInclude;

type ConversationSummaryRecord = Prisma.DirectConversationGetPayload<{
  include: typeof conversationSummaryInclude;
}>;

type ConversationDetailRecord = Prisma.DirectConversationGetPayload<{
  include: {
    participants: {
      include: typeof participantWithUserInclude;
    };
    messages: {
      include: typeof directMessageWithAuthorInclude;
    };
  };
}>;

@Injectable()
export class DirectMessagesService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly relationshipsService: RelationshipsService,
    private readonly realtimeService: CallsRealtimeService,
    private readonly queueService: QueueService,
  ) {}

  public async ensureRetentionSweepJob(): Promise<void> {
    await this.queueService.ensureDmRetentionSweepJob();
  }

  public async openConversation(
    actor: PublicUser,
    targetUsername: string,
    requestMetadata: RequestMetadata,
  ): Promise<DirectConversationSummary> {
    const targetUser = await this.resolveCounterpartByUsername(
      actor.id,
      targetUsername,
    );
    const profileDefaults = await this.prisma.profile.findMany({
      where: {
        userId: {
          in: [actor.id, targetUser.id],
        },
      },
      select: {
        userId: true,
        dmNotificationDefault: true,
      },
    });
    const notificationDefaults = new Map(
      profileDefaults.map((item) => [item.userId, item.dmNotificationDefault]),
    );

    await this.relationshipsService.assertInteractionAllowed(
      actor.id,
      targetUser.id,
    );

    const conversation = await this.prisma.directConversation.upsert({
      where: {
        pairKey: buildUserPairKey(actor.id, targetUser.id),
      },
      create: {
        pairKey: buildUserPairKey(actor.id, targetUser.id),
        createdByUserId: actor.id,
        participants: {
          create: [
            {
              userId: actor.id,
              notificationSetting: notificationDefaults.get(actor.id) ?? 'ALL',
            },
            {
              userId: targetUser.id,
              notificationSetting:
                notificationDefaults.get(targetUser.id) ?? 'ALL',
            },
          ],
        },
      },
      update: {},
      include: conversationSummaryInclude,
    });

    await this.auditService.write({
      action: 'dm.conversation.open',
      entityType: 'DirectConversation',
      entityId: conversation.id,
      actorUserId: actor.id,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      metadata: {
        targetUserId: targetUser.id,
      },
    });

    return this.toConversationSummary(conversation, actor.id);
  }

  public async listConversations(
    viewerId: string,
  ): Promise<DirectConversationSummary[]> {
    const conversations = await this.prisma.directConversation.findMany({
      where: {
        participants: {
          some: {
            userId: viewerId,
          },
        },
      },
      include: conversationSummaryInclude,
    });

    const items = await Promise.all(
      conversations.map((conversation) =>
        this.toConversationSummary(conversation, viewerId),
      ),
    );

    return items.sort((left, right) => {
      const leftTimestamp = left.lastMessageAt ?? '';
      const rightTimestamp = right.lastMessageAt ?? '';

      return rightTimestamp.localeCompare(leftTimestamp);
    });
  }

  public async getConversationDetail(
    viewerId: string,
    conversationId: string,
  ): Promise<DirectConversationDetail> {
    const conversation = await this.getConversationOrThrow(
      conversationId,
      viewerId,
    );
    const counterpart = this.getCounterpart(
      conversation.participants,
      viewerId,
    );
    const relationship = await this.relationshipsService.getRelationshipSummary(
      viewerId,
      counterpart.userId,
    );

    return toDirectConversationDetail({
      conversationId: conversation.id,
      viewerId,
      retentionMode: conversation.retentionMode,
      retentionSeconds: conversation.retentionSeconds,
      isBlockedByViewer: relationship.isBlockedByViewer,
      hasBlockedViewer: relationship.hasBlockedViewer,
      participants: conversation.participants,
      messages: [...conversation.messages].sort(
        (left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
      ),
    });
  }

  public async createMessage(
    actor: PublicUser,
    conversationId: string,
    input: CreateDirectMessageInput,
    requestMetadata: RequestMetadata,
  ) {
    const conversation = await this.getConversationOrThrow(
      conversationId,
      actor.id,
    );
    const counterpart = this.getCounterpart(
      conversation.participants,
      actor.id,
    );

    await this.relationshipsService.assertInteractionAllowed(
      actor.id,
      counterpart.userId,
    );

    const message = await this.prisma.$transaction(async (transaction) => {
      const createdMessage = await transaction.directMessage.create({
        data: {
          conversationId,
          authorId: actor.id,
          content: input.content.trim(),
        },
        include: directMessageWithAuthorInclude,
      });

      await transaction.directConversation.update({
        where: {
          id: conversationId,
        },
        data: {
          lastMessageAt: createdMessage.createdAt,
        },
      });

      await transaction.directConversationParticipant.update({
        where: {
          conversationId_userId: {
            conversationId,
            userId: actor.id,
          },
        },
        data: {
          lastReadMessageId: createdMessage.id,
          lastReadAt: createdMessage.createdAt,
        },
      });

      return createdMessage;
    });

    await this.auditService.write({
      action: 'dm.message.create',
      entityType: 'DirectMessage',
      entityId: message.id,
      actorUserId: actor.id,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      metadata: {
        conversationId,
      },
    });

    await this.emitConversationSignal({
      event: 'MESSAGE_CREATED',
      conversationId,
      actorUserId: actor.id,
      message,
      clientNonce: input.clientNonce ?? null,
    });

    return toDirectMessage(message, {
      viewerId: actor.id,
      clientNonce: input.clientNonce ?? null,
    });
  }

  public async deleteMessage(
    actor: PublicUser,
    conversationId: string,
    messageId: string,
    requestMetadata: RequestMetadata,
  ) {
    await this.getConversationOrThrow(conversationId, actor.id);

    const message = await this.prisma.directMessage.findFirst({
      where: {
        id: messageId,
        conversationId,
      },
      include: directMessageWithAuthorInclude,
    });

    if (!message) {
      throw new NotFoundException('Direct message not found');
    }

    if (message.authorId !== actor.id) {
      throw new ForbiddenException('Only the author can delete this message');
    }

    const deleteExpiresAt = new Date(
      message.createdAt.getTime() + DM_DELETE_WINDOW_MS,
    );

    if (deleteExpiresAt.getTime() <= Date.now()) {
      throw new ForbiddenException(
        'Messages can be deleted only within 1 hour after sending',
      );
    }

    const updatedMessage = await this.prisma.$transaction(async (transaction) => {
      const deletedMessage = await transaction.directMessage.update({
        where: {
          id: message.id,
        },
        data: {
          content: null,
          deletedAt: new Date(),
          deletedByUserId: actor.id,
        },
        include: directMessageWithAuthorInclude,
      });

      await this.syncConversationLastMessageAt(transaction, conversationId);

      return deletedMessage;
    });

    await this.auditService.write({
      action: 'dm.message.delete',
      entityType: 'DirectMessage',
      entityId: message.id,
      actorUserId: actor.id,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      metadata: {
        conversationId,
      },
    });

    await this.emitConversationSignal({
      event: 'MESSAGE_DELETED',
      conversationId,
      actorUserId: actor.id,
      messageId: updatedMessage.id,
    });

    return toDirectMessage(updatedMessage, {
      viewerId: actor.id,
    });
  }

  public async markConversationAsRead(
    viewerId: string,
    conversationId: string,
  ): Promise<void> {
    const conversation = await this.getConversationOrThrow(
      conversationId,
      viewerId,
    );
    const latestMessage = [...conversation.messages]
      .sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
      )
      .find((message) => !message.deletedAt);

    await this.prisma.directConversationParticipant.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId: viewerId,
        },
      },
      data: {
        lastReadMessageId: latestMessage?.id ?? null,
        lastReadAt: latestMessage?.createdAt ?? new Date(),
      },
    });

    await this.emitConversationSignal({
      event: 'CONVERSATION_READ',
      conversationId,
      actorUserId: viewerId,
      targetUserIds: [viewerId],
    });
  }

  public async updateConversationSettings(
    actor: PublicUser,
    conversationId: string,
    input: UpdateDmSettingsInput,
    requestMetadata: RequestMetadata,
  ): Promise<DirectConversationSummary> {
    await this.getConversationOrThrow(conversationId, actor.id);

    const retentionUpdate = this.resolveRetentionUpdate(input);

    const conversation = await this.prisma.$transaction(async (transaction) => {
      if (input.notificationSetting) {
        await transaction.directConversationParticipant.update({
          where: {
            conversationId_userId: {
              conversationId,
              userId: actor.id,
            },
          },
          data: {
            notificationSetting: input.notificationSetting,
          },
        });
      }

      if (retentionUpdate) {
        await transaction.directConversation.update({
          where: {
            id: conversationId,
          },
          data: retentionUpdate,
        });
      }

      return transaction.directConversation.findUniqueOrThrow({
        where: {
          id: conversationId,
        },
        include: conversationSummaryInclude,
      });
    });

    await this.auditService.write({
      action: 'dm.conversation.settings.update',
      entityType: 'DirectConversation',
      entityId: conversationId,
      actorUserId: actor.id,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      metadata: {
        notificationSetting: input.notificationSetting ?? null,
        retentionMode: retentionUpdate?.retentionMode ?? null,
        retentionSeconds: retentionUpdate?.retentionSeconds ?? null,
      },
    });

    await this.emitConversationSignal({
      event: 'CONVERSATION_UPDATED',
      conversationId,
      actorUserId: actor.id,
    });

    return this.toConversationSummary(conversation, actor.id);
  }

  public async cleanupExpiredMessages(now = new Date()): Promise<number> {
    const conversations = await this.prisma.directConversation.findMany({
      where: {
        retentionMode: {
          not: DmRetentionMode.OFF,
        },
      },
      select: {
        id: true,
        retentionMode: true,
        retentionSeconds: true,
      },
    });

    let cleanedMessagesCount = 0;

    for (const conversation of conversations) {
      const retentionSeconds = this.getRetentionSeconds(
        conversation.retentionMode,
        conversation.retentionSeconds,
      );

      if (!retentionSeconds) {
        continue;
      }

      const expiresBefore = new Date(now.getTime() - retentionSeconds * 1_000);
      const result = await this.prisma.directMessage.updateMany({
        where: {
          conversationId: conversation.id,
          deletedAt: null,
          createdAt: {
            lt: expiresBefore,
          },
        },
        data: {
          content: null,
          deletedAt: now,
          deletedByUserId: null,
        },
      });

      cleanedMessagesCount += result.count;

      if (result.count > 0) {
        await this.syncConversationLastMessageAt(this.prisma, conversation.id);
      }
    }

    return cleanedMessagesCount;
  }

  private async toConversationSummary(
    conversation: ConversationSummaryRecord,
    viewerId: string,
  ): Promise<DirectConversationSummary> {
    const participant = conversation.participants.find(
      (item) => item.userId === viewerId,
    );

    if (!participant) {
      throw new NotFoundException('Conversation participant not found');
    }

    const counterpart = this.getCounterpart(
      conversation.participants,
      viewerId,
    );
    const [relationship, unreadCount] = await Promise.all([
      this.relationshipsService.getRelationshipSummary(
        viewerId,
        counterpart.userId,
      ),
      this.prisma.directMessage.count({
        where: {
          conversationId: conversation.id,
          authorId: {
            not: viewerId,
          },
          deletedAt: null,
          ...(participant.lastReadAt
            ? {
                createdAt: {
                  gt: participant.lastReadAt,
                },
              }
            : {}),
        },
      }),
    ]);

    return toDirectConversationSummary({
      conversationId: conversation.id,
      lastMessageAt: conversation.lastMessageAt,
      unreadCount,
      retentionMode: conversation.retentionMode,
      retentionSeconds: conversation.retentionSeconds,
      counterpart: counterpart.user,
      participant,
      lastMessage: conversation.messages[0] ?? null,
      isBlockedByViewer: relationship.isBlockedByViewer,
      hasBlockedViewer: relationship.hasBlockedViewer,
    });
  }

  private resolveRetentionUpdate(input: UpdateDmSettingsInput) {
    if (!input.retentionMode) {
      return null;
    }

    return {
      retentionMode: input.retentionMode,
      retentionSeconds:
        input.retentionMode === 'CUSTOM'
          ? (input.customHours ?? 0) * 60 * 60
          : this.getRetentionSeconds(input.retentionMode, null),
    };
  }

  private getRetentionSeconds(
    retentionMode: DmRetentionMode | 'OFF' | 'H24' | 'D7' | 'D30' | 'CUSTOM',
    customSeconds: number | null,
  ): number | null {
    switch (retentionMode) {
      case DmRetentionMode.H24:
      case 'H24':
        return 24 * 60 * 60;
      case DmRetentionMode.D7:
      case 'D7':
        return 7 * 24 * 60 * 60;
      case DmRetentionMode.D30:
      case 'D30':
        return 30 * 24 * 60 * 60;
      case DmRetentionMode.CUSTOM:
      case 'CUSTOM':
        return customSeconds;
      default:
        return null;
    }
  }

  private async resolveCounterpartByUsername(
    actorUserId: string,
    targetUsername: string,
  ) {
    const targetUser = await this.prisma.user.findUnique({
      where: {
        username: targetUsername.trim().toLowerCase(),
      },
      select: {
        ...publicUserSelect,
        platformBlock: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    if (targetUser.id === actorUserId) {
      throw new ForbiddenException('Direct messages with self are not allowed');
    }

    if (targetUser.platformBlock) {
      throw new NotFoundException('User not found');
    }

    return targetUser;
  }

  private async syncConversationLastMessageAt(
    client: Prisma.TransactionClient | PrismaService,
    conversationId: string,
  ): Promise<void> {
    const latestMessage = await client.directMessage.findFirst({
      where: {
        conversationId,
        deletedAt: null,
      },
      select: {
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    await client.directConversation.update({
      where: {
        id: conversationId,
      },
      data: {
        lastMessageAt: latestMessage?.createdAt ?? null,
      },
    });
  }

  private async loadConversationSummaryForViewer(
    conversationId: string,
    viewerId: string,
  ): Promise<DirectConversationSummary> {
    const conversation = await this.prisma.directConversation.findFirst({
      where: {
        id: conversationId,
        participants: {
          some: {
            userId: viewerId,
          },
        },
      },
      include: conversationSummaryInclude,
    });

    if (!conversation) {
      throw new NotFoundException('Direct conversation not found');
    }

    return this.toConversationSummary(conversation, viewerId);
  }

  private async emitConversationSignal(args: {
    event: DmSignal['event'];
    conversationId: string;
    actorUserId: string | null;
    message?: MessageWithAuthor | null;
    messageId?: string | null;
    clientNonce?: string | null;
    targetUserIds?: string[];
  }): Promise<void> {
    const targetParticipants = await this.prisma.directConversationParticipant.findMany({
      where: {
        conversationId: args.conversationId,
        ...(args.targetUserIds
          ? {
              userId: {
                in: args.targetUserIds,
              },
            }
          : {}),
      },
      select: {
        userId: true,
      },
    });

    for (const participant of targetParticipants) {
      const summary = await this.loadConversationSummaryForViewer(
        args.conversationId,
        participant.userId,
      );

      this.realtimeService.emitDmSignalToUser(participant.userId, {
        event: args.event,
        conversationId: args.conversationId,
        conversation: summary,
        message: args.message
          ? toDirectMessage(args.message, {
              viewerId: participant.userId,
              clientNonce:
                participant.userId === args.actorUserId
                  ? (args.clientNonce ?? null)
                  : null,
            })
          : null,
        messageId: args.messageId ?? null,
        actorUserId: args.actorUserId,
      });
    }
  }

  private async getConversationOrThrow(
    conversationId: string,
    viewerId: string,
  ): Promise<ConversationDetailRecord> {
    const conversation = await this.prisma.directConversation.findFirst({
      where: {
        id: conversationId,
        participants: {
          some: {
            userId: viewerId,
          },
        },
      },
      include: {
        participants: {
          include: participantWithUserInclude,
        },
        messages: {
          where: {
            deletedAt: null,
          },
          include: directMessageWithAuthorInclude,
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Direct conversation not found');
    }

    return conversation;
  }

  private getCounterpart(
    participants: ParticipantWithUser[],
    viewerId: string,
  ): ParticipantWithUser {
    const counterpart = participants.find(
      (participant) => participant.userId !== viewerId,
    );

    if (!counterpart) {
      throw new NotFoundException('Conversation counterpart not found');
    }

    return counterpart;
  }
}
