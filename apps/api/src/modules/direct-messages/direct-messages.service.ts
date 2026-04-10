import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import type {
  CreateDirectMessageInput,
  DirectConversationDetail,
  DirectConversationSummary,
  DmSignal,
  PublicUser,
  UploadDirectMessageAttachmentInput,
  UpdateDmSettingsInput,
  UserRelationshipSummary,
} from '@lobby/shared';
import {
  DirectMessageAttachmentKind,
  DirectMessageType,
  DmRetentionMode,
  LinkEmbedProvider,
  LinkEmbedStatus,
  Prisma,
} from '@prisma/client';
import type { RequestMetadata } from '../../common/interfaces/request-metadata.interface';
import { buildUserPairKey } from '../../common/utils/user-pair-key.util';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { publicUserSelect } from '../auth/auth.mapper';
import { CallsRealtimeService } from '../calls/calls-realtime.service';
import { EnvService } from '../env/env.service';
import { MediaLibraryService } from '../media-library/media-library.service';
import { QueueService } from '../queue/queue.service';
import { RelationshipsService } from '../relationships/relationships.service';
import { StickersService } from '../stickers/stickers.service';
import {
  createUrlHash,
  extractFirstEmbeddableLink,
} from '../link-unfurl/link-unfurl.util';
import { StorageService } from '../storage/storage.service';
import { processDirectMessageAttachmentUpload } from '../storage/direct-message-attachment.util';
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
  sticker: true,
  gif: true,
  attachment: true,
  linkEmbed: true,
} satisfies Prisma.DirectMessageInclude;

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

const videoNoteFilePrefix = 'lobby-video-note-';
const recentVideoNoteWarmupLimit = 180;
const recentVideoNoteWarmupBatchSize = 18;
const videoNoteInlinePlaybackMimeType = 'video/mp4';

const directMessageAttachmentAccessSelect = {
  id: true,
  kind: true,
  fileKey: true,
  previewKey: true,
  originalName: true,
  mimeType: true,
  fileSize: true,
  width: true,
  height: true,
  durationMs: true,
} satisfies Prisma.DirectMessageAttachmentSelect;

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

type AttachmentAccessRecord = Prisma.DirectMessageAttachmentGetPayload<{
  select: typeof directMessageAttachmentAccessSelect;
}>;

type UploadedBinaryFile = {
  buffer: Buffer;
  size: number;
  originalname: string;
  mimetype?: string;
};

@Injectable()
export class DirectMessagesService implements OnModuleInit {
  private readonly logger = new Logger(DirectMessagesService.name);
  private isRecentVideoNoteWarmupRunning = false;
  private readonly pendingVideoNoteOptimizationIds = new Set<string>();

  public constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly relationshipsService: RelationshipsService,
    private readonly realtimeService: CallsRealtimeService,
    private readonly queueService: QueueService,
    private readonly stickersService: StickersService,
    private readonly mediaLibraryService: MediaLibraryService,
    private readonly envService: EnvService,
    private readonly storageService: StorageService,
  ) {}

  public onModuleInit(): void {
    if (this.envService.getValues().NODE_ENV === 'test') {
      return;
    }

    void this.warmRecentVideoNotesForFastPlayback();
  }

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

    const relationshipSummaries =
      await this.relationshipsService.getRelationshipSummaries(
        viewerId,
        conversations.map(
          (conversation) =>
            this.getCounterpart(conversation.participants, viewerId).userId,
        ),
      );

    const counterpartIds = conversations.map(
      (conversation) =>
        this.getCounterpart(conversation.participants, viewerId).userId,
    );
    const lastSeenAtByUserId =
      await this.getLastSeenAtByUserIds(counterpartIds);

    const items = await Promise.all(
      conversations.map((conversation) => {
        const counterpart = this.getCounterpart(
          conversation.participants,
          viewerId,
        );

        return this.toConversationSummary(
          conversation,
          viewerId,
          relationshipSummaries.get(counterpart.userId) ?? null,
          lastSeenAtByUserId,
        );
      }),
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
    const lastSeenAtByUserId = await this.getLastSeenAtByUserIds(
      conversation.participants.map((participant) => participant.userId),
    );

    return toDirectConversationDetail({
      conversationId: conversation.id,
      viewerId,
      retentionMode: conversation.retentionMode,
      retentionSeconds: conversation.retentionSeconds,
      friendshipState: relationship.friendshipState,
      isBlockedByViewer: relationship.isBlockedByViewer,
      hasBlockedViewer: relationship.hasBlockedViewer,
      participants: conversation.participants,
      messages: [...conversation.messages].sort(
        (left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
      ),
      lastSeenAtByUserId,
    });
  }

  public async createMessage(
    actor: PublicUser,
    conversationId: string,
    input: CreateDirectMessageInput,
    requestMetadata: RequestMetadata,
  ) {
    const messageType =
      (
        input as CreateDirectMessageInput & {
          type?: 'TEXT' | 'STICKER' | 'GIF';
          stickerId?: string | null;
          gifId?: string | null;
        }
      ).type ?? 'TEXT';
    const conversation = await this.getConversationOrThrow(
      conversationId,
      actor.id,
    );
    const counterpart = this.getCounterpart(
      conversation.participants,
      actor.id,
    );

    await this.relationshipsService.assertDirectMessagingAllowed(
      actor.id,
      counterpart.userId,
    );

    const trimmedContent = input.content?.trim() ?? null;
    const linkCandidate =
      messageType === 'TEXT'
        ? extractFirstEmbeddableLink(trimmedContent)
        : null;
    const sticker =
      messageType === 'STICKER' && input.stickerId
        ? await this.stickersService.getActiveStickerOrThrow(input.stickerId)
        : null;
    const gif =
      messageType === 'GIF' && input.gifId
        ? await this.mediaLibraryService.getActiveGifOrThrow(input.gifId)
        : null;

    const messageId = await this.prisma.$transaction(async (transaction) => {
      const createdMessage = await transaction.directMessage.create({
        data: {
          conversationId,
          authorId: actor.id,
          type:
            messageType === 'STICKER'
              ? DirectMessageType.STICKER
              : messageType === 'GIF'
                ? DirectMessageType.GIF
                : DirectMessageType.TEXT,
          content: messageType === 'TEXT' ? trimmedContent : null,
          stickerId: sticker?.id ?? null,
          stickerSnapshot: sticker
            ? this.buildStickerSnapshot(sticker)
            : Prisma.JsonNull,
          gifId: gif?.id ?? null,
        },
        include: directMessageWithAuthorInclude,
      });

      if (linkCandidate) {
        await transaction.directMessageLinkEmbed.create({
          data: {
            messageId: createdMessage.id,
            provider: LinkEmbedProvider[linkCandidate.provider],
            sourceUrl: linkCandidate.sourceUrl,
            sourceUrlHash: createUrlHash(linkCandidate.sourceUrl),
          },
        });
      }

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

      if (sticker) {
        await this.stickersService.recordStickerUsage(
          actor.id,
          sticker.id,
          sticker.packId,
          transaction,
        );
      }

      return createdMessage.id;
    });
    let message = await this.loadMessageOrThrow(messageId);

    await this.auditService.write({
      action: 'dm.message.create',
      entityType: 'DirectMessage',
      entityId: messageId,
      actorUserId: actor.id,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      metadata: {
        conversationId,
        type: message.type,
        stickerId: message.stickerId ?? null,
        gifId: message.gifId ?? null,
        linkProvider: linkCandidate?.provider ?? null,
        linkUrl: linkCandidate?.sourceUrl ?? null,
      },
    });

    await this.emitConversationSignal({
      event: 'MESSAGE_CREATED',
      conversationId,
      actorUserId: actor.id,
      message,
      clientNonce: input.clientNonce ?? null,
    });

    if (linkCandidate) {
      try {
        await this.queueService.enqueueDmLinkUnfurl(messageId);
      } catch {
        await this.prisma.directMessageLinkEmbed.update({
          where: {
            messageId,
          },
          data: {
            status: LinkEmbedStatus.FAILED,
            failureCode: 'QUEUE_ENQUEUE_FAILED',
          },
        });
        await this.emitMessageUpdatedSignal(messageId);
        this.logger.warn(
          `Failed to enqueue DM link unfurl for message ${messageId}`,
        );
        message = await this.loadMessageOrThrow(messageId);
      }
    }

    return toDirectMessage(message, {
      viewerId: actor.id,
      clientNonce: input.clientNonce ?? null,
    });
  }

  public async createAttachmentMessage(
    actor: PublicUser,
    conversationId: string,
    input: UploadDirectMessageAttachmentInput,
    file: UploadedBinaryFile | undefined,
    requestMetadata: RequestMetadata,
  ) {
    if (!file?.buffer || file.size === 0) {
      throw new BadRequestException('Выберите файл для отправки.');
    }

    const conversation = await this.getConversationOrThrow(
      conversationId,
      actor.id,
    );
    const counterpart = this.getCounterpart(
      conversation.participants,
      actor.id,
    );

    await this.relationshipsService.assertDirectMessagingAllowed(
      actor.id,
      counterpart.userId,
    );

    const env = this.envService.getValues();
    const processed = await this.processAttachmentUpload(file, env.MAX_FILE_MB);
    const fileKey = await this.storageService.writeDirectMessageAttachment(
      processed.assetBuffer,
      processed.extension,
    );
    const inlinePlaybackKey =
      processed.inlinePlaybackBuffer && processed.inlinePlaybackExtension
        ? this.resolveVideoNoteInlinePlaybackFileKey(fileKey)
        : null;
    let previewKey: string | null = null;
    let storedInlinePlaybackKey: string | null = null;

    try {
      [previewKey, storedInlinePlaybackKey] = await Promise.all([
        processed.previewBuffer && processed.previewExtension
          ? this.storageService.writeDirectMessageAttachmentPreview(
              processed.previewBuffer,
              processed.previewExtension,
            )
          : Promise.resolve<string | null>(null),
        inlinePlaybackKey && processed.inlinePlaybackBuffer
          ? this.storageService.writeObjectAtKey(
              inlinePlaybackKey,
              processed.inlinePlaybackBuffer,
            )
          : Promise.resolve<string | null>(null),
      ]);

      const messageId = await this.prisma.$transaction(async (transaction) => {
        const createdMessage = await transaction.directMessage.create({
          data: {
            conversationId,
            authorId: actor.id,
            type:
              processed.kind === 'DOCUMENT'
                ? DirectMessageType.FILE
                : DirectMessageType.MEDIA,
            content: null,
            stickerSnapshot: Prisma.JsonNull,
            attachment: {
              create: {
                kind:
                  processed.kind === 'VIDEO'
                    ? DirectMessageAttachmentKind.VIDEO
                    : processed.kind === 'DOCUMENT'
                      ? DirectMessageAttachmentKind.DOCUMENT
                      : DirectMessageAttachmentKind.IMAGE,
                fileKey,
                previewKey,
                originalName: processed.originalName,
                mimeType: processed.mimeType,
                fileSize: processed.fileSize,
                width: processed.width,
                height: processed.height,
                durationMs: processed.durationMs,
              },
            },
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

        return createdMessage.id;
      });
      const message = await this.loadMessageOrThrow(messageId);

      await this.auditService.write({
        action: 'dm.message.attachment.create',
        entityType: 'DirectMessage',
        entityId: messageId,
        actorUserId: actor.id,
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
        metadata: {
          conversationId,
          attachmentKind: processed.kind,
          mimeType: processed.mimeType,
          fileSize: processed.fileSize,
          originalName: processed.originalName,
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
    } catch (error) {
      await Promise.all([
        this.storageService.deleteObject(fileKey),
        this.storageService.deleteObject(previewKey),
        this.storageService.deleteObject(storedInlinePlaybackKey),
      ]);
      throw error;
    }
  }

  public async getAttachmentAssetForViewer(
    viewerId: string,
    attachmentId: string,
    variant: 'asset' | 'preview',
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    const attachment = await this.prisma.directMessageAttachment.findFirst({
      where: {
        id: attachmentId,
        message: {
          deletedAt: null,
          conversation: {
            participants: {
              some: {
                userId: viewerId,
              },
            },
          },
        },
      },
      select: {
        id: true,
        kind: true,
        fileKey: true,
        previewKey: true,
        originalName: true,
        mimeType: true,
        fileSize: true,
        width: true,
        height: true,
        durationMs: true,
      },
    });

    if (!attachment) {
      throw new NotFoundException('Вложение недоступно.');
    }

    if (variant === 'asset') {
      this.scheduleLegacyVideoNoteOptimization(attachment);
    }

    const fileKey =
      variant === 'preview' ? attachment.previewKey : attachment.fileKey;

    if (!fileKey) {
      throw new NotFoundException('Превью вложения недоступно.');
    }

    try {
      return {
        buffer: await this.storageService.readObject(fileKey),
        mimeType: variant === 'preview' ? 'image/webp' : attachment.mimeType,
      };
    } catch {
      throw new NotFoundException('Файл вложения недоступен.');
    }
  }

  public async getAttachmentAssetDescriptorForViewer(
    viewerId: string,
    attachmentId: string,
    variant: 'asset' | 'preview',
  ): Promise<{ fileKey: string; mimeType: string; size: number }> {
    const attachment = await this.prisma.directMessageAttachment.findFirst({
      where: {
        id: attachmentId,
        message: {
          deletedAt: null,
          conversation: {
            participants: {
              some: {
                userId: viewerId,
              },
            },
          },
        },
      },
      select: {
        id: true,
        kind: true,
        fileKey: true,
        previewKey: true,
        originalName: true,
        mimeType: true,
        fileSize: true,
        width: true,
        height: true,
        durationMs: true,
      },
    });

    if (!attachment) {
      throw new NotFoundException('Р’Р»РѕР¶РµРЅРёРµ РЅРµРґРѕСЃС‚СѓРїРЅРѕ.');
    }

    if (variant === 'asset') {
      this.scheduleLegacyVideoNoteOptimization(attachment);
    }

    const fileKey =
      variant === 'preview' ? attachment.previewKey : attachment.fileKey;

    if (!fileKey) {
      throw new NotFoundException(
        'РџСЂРµРІСЊСЋ РІР»РѕР¶РµРЅРёСЏ РЅРµРґРѕСЃС‚СѓРїРЅРѕ.',
      );
    }

    return {
      fileKey,
      mimeType: variant === 'preview' ? 'image/webp' : attachment.mimeType,
      size: await this.storageService.getObjectSize(fileKey),
    };
  }

  public async getAttachmentInlinePlaybackDescriptorForViewer(
    viewerId: string,
    attachmentId: string,
  ): Promise<{
    fileKey: string;
    mimeType: string;
    size: number;
    isInlinePlayback: boolean;
  }> {
    const attachment = await this.prisma.directMessageAttachment.findFirst({
      where: {
        id: attachmentId,
        message: {
          deletedAt: null,
          conversation: {
            participants: {
              some: {
                userId: viewerId,
              },
            },
          },
        },
      },
      select: directMessageAttachmentAccessSelect,
    });

    if (!attachment) {
      throw new NotFoundException('Вложение недоступно.');
    }

    if (!this.isVideoNoteAttachment(attachment)) {
      return {
        fileKey: attachment.fileKey,
        mimeType: attachment.mimeType,
        size: await this.storageService.getObjectSize(attachment.fileKey),
        isInlinePlayback: false,
      };
    }

    this.scheduleLegacyVideoNoteOptimization(attachment);

    const inlinePlaybackFileKey = this.resolveVideoNoteInlinePlaybackFileKey(
      attachment.fileKey,
    );

    try {
      return {
        fileKey: inlinePlaybackFileKey,
        mimeType: videoNoteInlinePlaybackMimeType,
        size: await this.storageService.getObjectSize(inlinePlaybackFileKey),
        isInlinePlayback: true,
      };
    } catch {
      return {
        fileKey: attachment.fileKey,
        mimeType: attachment.mimeType,
        size: await this.storageService.getObjectSize(attachment.fileKey),
        isInlinePlayback: false,
      };
    }
  }

  public async readAttachmentAssetRange(
    fileKey: string,
    start: number,
    end: number,
  ): Promise<Buffer> {
    return await this.storageService.readObjectRange(fileKey, start, end);
  }

  public async readAttachmentAsset(fileKey: string): Promise<Buffer> {
    return await this.storageService.readObject(fileKey);
  }

  private resolveVideoNoteInlinePlaybackFileKey(fileKey: string): string {
    return fileKey.replace(/\.[^.\\/]+$/, '.inline.mp4');
  }

  private isVideoNoteAttachment(
    attachment: Pick<AttachmentAccessRecord, 'kind' | 'originalName'>,
  ): boolean {
    return (
      attachment.kind === DirectMessageAttachmentKind.VIDEO &&
      attachment.originalName
        .trim()
        .toLowerCase()
        .startsWith(videoNoteFilePrefix)
    );
  }

  private scheduleLegacyVideoNoteOptimization(attachment: {
    id: string;
    kind: DirectMessageAttachmentKind;
    fileKey: string;
    previewKey: string | null;
    originalName: string;
    mimeType: string;
    fileSize: number;
    width: number | null;
    height: number | null;
    durationMs: number | null;
  }): void {
    if (
      !this.shouldOptimizeLegacyVideoNoteAttachment(attachment) ||
      this.pendingVideoNoteOptimizationIds.has(attachment.id)
    ) {
      return;
    }

    this.pendingVideoNoteOptimizationIds.add(attachment.id);

    queueMicrotask(() => {
      void this.maybeOptimizeLegacyVideoNoteAttachmentForFastPlayback(
        attachment,
      ).finally(() => {
        this.pendingVideoNoteOptimizationIds.delete(attachment.id);
      });
    });
  }

  private async warmRecentVideoNotesForFastPlayback(): Promise<void> {
    if (this.isRecentVideoNoteWarmupRunning) {
      return;
    }

    this.isRecentVideoNoteWarmupRunning = true;

    try {
      const warmedAttachmentIds: string[] = [];
      let warmedCount = 0;

      while (warmedCount < recentVideoNoteWarmupLimit) {
        const attachments = await this.prisma.directMessageAttachment.findMany({
          where: {
            kind: DirectMessageAttachmentKind.VIDEO,
            originalName: {
              startsWith: videoNoteFilePrefix,
            },
            ...(warmedAttachmentIds.length > 0
              ? {
                  id: {
                    notIn: warmedAttachmentIds,
                  },
                }
              : {}),
          },
          orderBy: {
            updatedAt: 'desc',
          },
          take: recentVideoNoteWarmupBatchSize,
          select: directMessageAttachmentAccessSelect,
        });

        if (attachments.length === 0) {
          break;
        }

        for (const attachment of attachments) {
          warmedAttachmentIds.push(attachment.id);
          if (this.pendingVideoNoteOptimizationIds.has(attachment.id)) {
            continue;
          }

          this.pendingVideoNoteOptimizationIds.add(attachment.id);

          try {
            await this.maybeOptimizeLegacyVideoNoteAttachmentForFastPlayback(
              attachment,
            );
          } finally {
            this.pendingVideoNoteOptimizationIds.delete(attachment.id);
          }

          warmedCount += 1;
        }
      }

      if (warmedCount > 0) {
        this.logger.log(
          `Prepared fast inline playback for ${warmedCount} DM video notes`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Failed to warm recent DM video notes: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    } finally {
      this.isRecentVideoNoteWarmupRunning = false;
    }
  }

  private async maybeOptimizeLegacyVideoNoteAttachmentForFastPlayback(attachment: {
    id: string;
    kind: DirectMessageAttachmentKind;
    fileKey: string;
    previewKey: string | null;
    originalName: string;
    mimeType: string;
    fileSize: number;
    width: number | null;
    height: number | null;
    durationMs: number | null;
  }) {
    if (!this.shouldOptimizeLegacyVideoNoteAttachment(attachment)) {
      return attachment;
    }

    const inlinePlaybackFileKey = this.resolveVideoNoteInlinePlaybackFileKey(
      attachment.fileKey,
    );

    try {
      try {
        await this.storageService.getObjectSize(inlinePlaybackFileKey);
        return attachment;
      } catch {
        // Inline playback stream is missing and needs to be prepared.
      }

      const env = this.envService.getValues();
      const sourceBuffer = await this.storageService.readObject(
        attachment.fileKey,
      );
      const processed = await processDirectMessageAttachmentUpload({
        buffer: sourceBuffer,
        originalName: attachment.originalName,
        mimeType: attachment.mimeType,
        limits: {
          maxBytes: Math.floor(env.MAX_FILE_MB * 1024 * 1024),
          maxImageDimension: 6_000,
          maxVideoDimension: 3_840,
          maxVideoDurationMs: 5 * 60 * 1_000,
        },
      });

      if (processed.kind !== 'VIDEO' || !processed.inlinePlaybackBuffer) {
        return attachment;
      }

      await this.storageService.writeObjectAtKey(
        inlinePlaybackFileKey,
        processed.inlinePlaybackBuffer,
      );

      return attachment;
    } catch (error) {
      this.logger.warn(
        `Failed to prepare fast inline playback for DM video note ${attachment.id}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );

      return attachment;
    }
  }

  private shouldOptimizeLegacyVideoNoteAttachment(attachment: {
    kind: DirectMessageAttachmentKind;
    originalName: string;
    mimeType: string;
    width: number | null;
    height: number | null;
  }) {
    return this.isVideoNoteAttachment(attachment);
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

    if (message.deletedAt) {
      return toDirectMessage(message, {
        viewerId: actor.id,
      });
    }

    const updatedMessage = await this.prisma.$transaction(
      async (transaction) => {
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
      },
    );

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

    const nextLastReadAt = latestMessage?.createdAt ?? new Date();
    const nextLastReadMessageId = latestMessage?.id ?? null;

    await this.prisma.directConversationParticipant.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId: viewerId,
        },
      },
      data: {
        lastReadMessageId: nextLastReadMessageId,
        lastReadAt: nextLastReadAt,
      },
    });

    await this.emitConversationSignal({
      event: 'CONVERSATION_READ',
      conversationId,
      actorUserId: viewerId,
      readState: {
        userId: viewerId,
        lastReadMessageId: nextLastReadMessageId,
        lastReadAt: nextLastReadAt,
      },
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

  public async emitMessageUpdatedSignal(messageId: string): Promise<void> {
    const message = await this.loadMessageOrThrow(messageId);

    await this.emitConversationSignal({
      event: 'MESSAGE_UPDATED',
      conversationId: message.conversationId,
      actorUserId: null,
      message,
    });
  }

  private async toConversationSummary(
    conversation: ConversationSummaryRecord,
    viewerId: string,
    relationshipOverride?: UserRelationshipSummary | null,
    lastSeenAtByUserId?: Map<string, Date | null>,
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
      relationshipOverride ??
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
    const counterpartLastSeenAt =
      lastSeenAtByUserId && lastSeenAtByUserId.has(counterpart.userId)
        ? (lastSeenAtByUserId.get(counterpart.userId) ?? null)
        : ((await this.getLastSeenAtByUserIds([counterpart.userId])).get(
            counterpart.userId,
          ) ?? null);

    return toDirectConversationSummary({
      conversationId: conversation.id,
      lastMessageAt: conversation.lastMessageAt,
      unreadCount,
      retentionMode: conversation.retentionMode,
      retentionSeconds: conversation.retentionSeconds,
      counterpart: counterpart.user,
      counterpartLastSeenAt,
      participant,
      lastMessage: conversation.messages[0] ?? null,
      friendshipState: relationship.friendshipState,
      isBlockedByViewer: relationship.isBlockedByViewer,
      hasBlockedViewer: relationship.hasBlockedViewer,
    });
  }

  private async getLastSeenAtByUserIds(userIds: string[]) {
    const uniqueUserIds = [...new Set(userIds)];

    if (uniqueUserIds.length === 0) {
      return new Map<string, Date | null>();
    }

    const entries = await this.prisma.session.groupBy({
      by: ['userId'],
      where: {
        userId: {
          in: uniqueUserIds,
        },
      },
      _max: {
        lastActiveAt: true,
      },
    });

    const lastSeenAtByUserId = new Map<string, Date | null>(
      uniqueUserIds.map((userId) => [userId, null]),
    );

    entries.forEach((entry) => {
      lastSeenAtByUserId.set(entry.userId, entry._max.lastActiveAt ?? null);
    });

    return lastSeenAtByUserId;
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

  private async processAttachmentUpload(
    file: UploadedBinaryFile,
    maxFileMb: number,
  ) {
    try {
      return await processDirectMessageAttachmentUpload({
        buffer: file.buffer,
        originalName: file.originalname,
        mimeType: file.mimetype,
        limits: {
          maxBytes: Math.floor(maxFileMb * 1024 * 1024),
          maxImageDimension: 6_000,
          maxVideoDimension: 3_840,
          maxVideoDurationMs: 5 * 60 * 1_000,
        },
      });
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : 'Не удалось обработать вложение.',
      );
    }
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

  private async loadMessageOrThrow(
    messageId: string,
  ): Promise<MessageWithAuthor> {
    return await this.prisma.directMessage.findUniqueOrThrow({
      where: {
        id: messageId,
      },
      include: directMessageWithAuthorInclude,
    });
  }

  private async emitConversationSignal(args: {
    event: DmSignal['event'] | 'MESSAGE_UPDATED';
    conversationId: string;
    actorUserId: string | null;
    message?: MessageWithAuthor | null;
    messageId?: string | null;
    clientNonce?: string | null;
    targetUserIds?: string[];
    readState?: {
      userId: string;
      lastReadMessageId: string | null;
      lastReadAt: Date | null;
    } | null;
  }): Promise<void> {
    const targetParticipants =
      await this.prisma.directConversationParticipant.findMany({
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
        readState: args.readState
          ? {
              userId: args.readState.userId,
              lastReadMessageId: args.readState.lastReadMessageId,
              lastReadAt: args.readState.lastReadAt?.toISOString() ?? null,
            }
          : null,
      } as DmSignal);
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

  private buildStickerSnapshot(sticker: {
    id: string;
    packId: string;
    title: string;
    fileKey: string;
    animatedFileKey?: string | null;
    animatedMimeType?: string | null;
    originalName: string | null;
    mimeType: string;
    fileSize: number;
    sourceFileKey?: string | null;
    sourceMimeType?: string | null;
    sourceFileSize?: number | null;
    width: number;
    height: number;
    type?: 'STATIC' | 'ANIMATED' | null;
    isAnimated: boolean;
    durationMs?: number | null;
    keywords?: Prisma.JsonValue | null;
    isActive: boolean;
    publishedAt?: Date | null;
    archivedAt?: Date | null;
    deletedAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): Prisma.InputJsonValue {
    return {
      id: sticker.id,
      packId: sticker.packId,
      title: sticker.title,
      type: sticker.type ?? (sticker.isAnimated ? 'ANIMATED' : 'STATIC'),
      fileKey: sticker.fileKey,
      animatedFileKey: sticker.animatedFileKey ?? null,
      animatedMimeType: sticker.animatedMimeType ?? null,
      originalName: sticker.originalName,
      mimeType: sticker.mimeType,
      fileSize: sticker.fileSize,
      sourceFileKey: sticker.sourceFileKey ?? null,
      sourceMimeType: sticker.sourceMimeType ?? null,
      sourceFileSize: sticker.sourceFileSize ?? null,
      width: sticker.width,
      height: sticker.height,
      isAnimated: sticker.isAnimated,
      durationMs: sticker.durationMs ?? null,
      keywords: Array.isArray(sticker.keywords)
        ? sticker.keywords.filter(
            (item): item is string => typeof item === 'string',
          )
        : [],
      isActive: sticker.isActive,
      publishedAt: sticker.publishedAt?.toISOString() ?? null,
      archivedAt: sticker.archivedAt?.toISOString() ?? null,
      deletedAt: sticker.deletedAt?.toISOString() ?? null,
      createdAt: sticker.createdAt.toISOString(),
      updatedAt: sticker.updatedAt.toISOString(),
    } satisfies Record<string, Prisma.InputJsonValue | null>;
  }
}
