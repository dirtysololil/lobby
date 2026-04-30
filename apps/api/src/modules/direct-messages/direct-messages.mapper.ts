import {
  directConversationDetailSchema,
  directConversationSummarySchema,
  directMessageReplyPreviewSchema,
  directMessageSchema,
  stickerAssetSchema,
  type FriendshipState,
  type DirectConversationDetail,
  type DirectConversationSummary,
  type DirectMessage,
} from '@lobby/shared';
import type {
  DirectMessageAttachment as PrismaDirectMessageAttachment,
  DirectConversationParticipant,
  DirectMessage as PrismaDirectMessage,
  DirectMessageLinkEmbed as PrismaDirectMessageLinkEmbed,
  DirectMessageReaction as PrismaDirectMessageReaction,
  GifAsset as PrismaGifAsset,
  Sticker as PrismaSticker,
} from '@prisma/client';
import { toContentReactions } from '../../common/utils/content-reactions.util';
import { toPublicUser, type PublicUserRecord } from '../auth/auth.mapper';
import { toGifAsset } from '../media-library/media-library.mapper';
import { toStickerAsset } from '../stickers/stickers.mapper';

export type MessageWithAuthor = PrismaDirectMessage & {
  author: PublicUserRecord;
  sticker: PrismaSticker | null;
  gif: PrismaGifAsset | null;
  attachment: PrismaDirectMessageAttachment | null;
  linkEmbed: PrismaDirectMessageLinkEmbed | null;
  reactions: Array<Pick<PrismaDirectMessageReaction, 'emoji' | 'userId'>>;
  replyTo?: ReplyPreviewWithAuthor | null;
};

export type ReplyPreviewWithAuthor = PrismaDirectMessage & {
  author: PublicUserRecord;
  sticker: PrismaSticker | null;
  gif: PrismaGifAsset | null;
  attachment: PrismaDirectMessageAttachment | null;
};

export type ParticipantWithUser = DirectConversationParticipant & {
  user: PublicUserRecord;
};

export function toDirectMessage(
  message: MessageWithAuthor,
  options?: {
    viewerId?: string;
    clientNonce?: string | null;
  },
): DirectMessage {
  const canDelete =
    !message.deletedAt && options?.viewerId === message.authorId;

  return directMessageSchema.parse({
    id: message.id,
    conversationId: message.conversationId,
    type: message.type,
    author: toPublicUser(message.author),
    content: message.deletedAt ? null : message.content,
    sticker: resolveStickerPayload(message),
    gif: message.gif ? toGifAsset(message.gif) : null,
    attachment:
      !message.deletedAt && message.attachment
        ? {
            id: message.attachment.id,
            kind: message.attachment.kind,
            originalName: message.attachment.originalName,
            mimeType: message.attachment.mimeType,
            fileSize: message.attachment.fileSize,
            width: message.attachment.width,
            height: message.attachment.height,
            durationMs: message.attachment.durationMs,
            hasPreview: Boolean(message.attachment.previewKey),
            createdAt: message.attachment.createdAt.toISOString(),
            updatedAt: message.attachment.updatedAt.toISOString(),
          }
        : null,
    linkEmbed:
      !message.deletedAt && message.linkEmbed
        ? {
            status: message.linkEmbed.status,
            provider: message.linkEmbed.provider,
            kind: message.linkEmbed.kind,
            sourceUrl: message.linkEmbed.sourceUrl,
            canonicalUrl: message.linkEmbed.canonicalUrl,
            previewUrl: message.linkEmbed.previewUrl,
            playableUrl: message.linkEmbed.playableUrl,
            posterUrl: message.linkEmbed.posterUrl,
            width: message.linkEmbed.width,
            height: message.linkEmbed.height,
            aspectRatio: message.linkEmbed.aspectRatio,
            failureCode: message.linkEmbed.failureCode,
          }
        : null,
    replyTo: !message.deletedAt
      ? toDirectMessageReplyPreview(message.replyTo ?? null)
      : null,
    isDeleted: Boolean(message.deletedAt),
    canDelete,
    deleteExpiresAt: null,
    clientNonce: options?.clientNonce ?? null,
    reactions: toContentReactions(message.reactions, options?.viewerId),
    createdAt: message.createdAt.toISOString(),
    updatedAt: message.updatedAt.toISOString(),
  });
}

function resolveStickerPayload(message: {
  deletedAt: Date | null;
  sticker: PrismaSticker | null;
  stickerSnapshot: unknown;
}) {
  if (message.deletedAt) {
    return null;
  }

  if (message.sticker) {
    return toStickerAsset(message.sticker);
  }

  if (!message.stickerSnapshot) {
    return null;
  }

  return stickerAssetSchema.parse(message.stickerSnapshot);
}

export function toDirectConversationSummary(args: {
  conversationId: string;
  lastMessageAt: Date | null;
  unreadCount: number;
  retentionMode: string;
  retentionSeconds: number | null;
  counterpart: PublicUserRecord;
  counterpartLastSeenAt: Date | null;
  participant: DirectConversationParticipant;
  lastMessage: MessageWithAuthor | null;
  friendshipState: FriendshipState;
  isBlockedByViewer: boolean;
  hasBlockedViewer: boolean;
}): DirectConversationSummary {
  return directConversationSummarySchema.parse({
    id: args.conversationId,
    lastMessageAt: args.lastMessageAt?.toISOString() ?? null,
    unreadCount: args.unreadCount,
    retentionMode: args.retentionMode,
    retentionSeconds: args.retentionSeconds,
    counterpart: toPublicUser(args.counterpart, {
      lastSeenAt: args.counterpartLastSeenAt,
    }),
    settings: {
      notificationSetting: args.participant.notificationSetting,
      lastReadMessageId: args.participant.lastReadMessageId,
      lastReadAt: args.participant.lastReadAt?.toISOString() ?? null,
    },
    lastMessagePreview: getDirectMessagePreview(
      args.lastMessage,
      args.participant.userId,
    ),
    lastMessage: args.lastMessage
      ? toDirectMessage(args.lastMessage, {
          viewerId: args.participant.userId,
        })
      : null,
    friendshipState: args.friendshipState,
    isBlockedByViewer: args.isBlockedByViewer,
    hasBlockedViewer: args.hasBlockedViewer,
  });
}

function toDirectMessageReplyPreview(
  message: ReplyPreviewWithAuthor | null | undefined,
) {
  if (!message) {
    return null;
  }

  return directMessageReplyPreviewSchema.parse({
    id: message.id,
    conversationId: message.conversationId,
    type: message.type,
    author: toPublicUser(message.author),
    content: message.deletedAt ? null : message.content,
    sticker: resolveStickerPayload(message),
    gif: !message.deletedAt && message.gif ? toGifAsset(message.gif) : null,
    attachment:
      !message.deletedAt && message.attachment
        ? {
            id: message.attachment.id,
            kind: message.attachment.kind,
            originalName: message.attachment.originalName,
            mimeType: message.attachment.mimeType,
            fileSize: message.attachment.fileSize,
            width: message.attachment.width,
            height: message.attachment.height,
            durationMs: message.attachment.durationMs,
            hasPreview: Boolean(message.attachment.previewKey),
            createdAt: message.attachment.createdAt.toISOString(),
            updatedAt: message.attachment.updatedAt.toISOString(),
          }
        : null,
    isDeleted: Boolean(message.deletedAt),
    createdAt: message.createdAt.toISOString(),
  });
}

export function toDirectConversationDetail(args: {
  conversationId: string;
  viewerId: string;
  retentionMode: string;
  retentionSeconds: number | null;
  friendshipState: FriendshipState;
  isBlockedByViewer: boolean;
  hasBlockedViewer: boolean;
  participants: ParticipantWithUser[];
  messages: MessageWithAuthor[];
  lastSeenAtByUserId?: Map<string, Date | null>;
}): DirectConversationDetail {
  return directConversationDetailSchema.parse({
    conversation: {
      id: args.conversationId,
      retentionMode: args.retentionMode,
      retentionSeconds: args.retentionSeconds,
      friendshipState: args.friendshipState,
      isBlockedByViewer: args.isBlockedByViewer,
      hasBlockedViewer: args.hasBlockedViewer,
      participants: args.participants.map((participant) => ({
        user: toPublicUser(participant.user, {
          lastSeenAt: args.lastSeenAtByUserId?.get(participant.userId) ?? null,
        }),
        notificationSetting: participant.notificationSetting,
        lastReadMessageId: participant.lastReadMessageId,
        lastReadAt: participant.lastReadAt?.toISOString() ?? null,
      })),
      messages: args.messages.map((message) =>
        toDirectMessage(message, {
          viewerId: args.viewerId,
        }),
      ),
    },
  });
}

function getDirectMessagePreview(
  message: MessageWithAuthor | null,
  viewerId: string,
): string | null {
  if (!message || message.deletedAt) {
    return null;
  }

  if (message.type === 'STICKER') {
    return message.authorId === viewerId ? 'Вы отправили стикер' : 'Стикер';
  }

  if (message.type === 'GIF') {
    return message.authorId === viewerId ? 'Вы отправили GIF' : 'GIF';
  }

  if (message.type === 'MEDIA') {
    if (message.attachment?.kind === 'VIDEO') {
      return message.authorId === viewerId ? 'Вы отправили видео' : 'Видео';
    }

    return message.authorId === viewerId ? 'Вы отправили фото' : 'Фото';
  }

  if (message.type === 'FILE') {
    return message.authorId === viewerId ? 'Вы отправили файл' : 'Файл';
  }

  return message.content?.trim() || null;
}
