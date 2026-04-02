import {
  directConversationDetailSchema,
  directConversationSummarySchema,
  directMessageSchema,
  type DirectConversationDetail,
  type DirectConversationSummary,
  type DirectMessage,
} from '@lobby/shared';
import type {
  DirectConversationParticipant,
  DirectMessage as PrismaDirectMessage,
} from '@prisma/client';
import { toPublicUser, type PublicUserRecord } from '../auth/auth.mapper';

export type MessageWithAuthor = PrismaDirectMessage & {
  author: PublicUserRecord;
};

export type ParticipantWithUser = DirectConversationParticipant & {
  user: PublicUserRecord;
};

export function toDirectMessage(message: MessageWithAuthor): DirectMessage {
  return directMessageSchema.parse({
    id: message.id,
    conversationId: message.conversationId,
    author: toPublicUser(message.author),
    content: message.deletedAt ? null : message.content,
    isDeleted: Boolean(message.deletedAt),
    createdAt: message.createdAt.toISOString(),
    updatedAt: message.updatedAt.toISOString(),
  });
}

export function toDirectConversationSummary(args: {
  conversationId: string;
  lastMessageAt: Date | null;
  unreadCount: number;
  retentionMode: string;
  retentionSeconds: number | null;
  counterpart: PublicUserRecord;
  participant: DirectConversationParticipant;
  lastMessage: MessageWithAuthor | null;
  isBlockedByViewer: boolean;
  hasBlockedViewer: boolean;
}): DirectConversationSummary {
  return directConversationSummarySchema.parse({
    id: args.conversationId,
    lastMessageAt: args.lastMessageAt?.toISOString() ?? null,
    unreadCount: args.unreadCount,
    retentionMode: args.retentionMode,
    retentionSeconds: args.retentionSeconds,
    counterpart: toPublicUser(args.counterpart),
    settings: {
      notificationSetting: args.participant.notificationSetting,
      lastReadMessageId: args.participant.lastReadMessageId,
      lastReadAt: args.participant.lastReadAt?.toISOString() ?? null,
    },
    lastMessage: args.lastMessage ? toDirectMessage(args.lastMessage) : null,
    isBlockedByViewer: args.isBlockedByViewer,
    hasBlockedViewer: args.hasBlockedViewer,
  });
}

export function toDirectConversationDetail(args: {
  conversationId: string;
  retentionMode: string;
  retentionSeconds: number | null;
  isBlockedByViewer: boolean;
  hasBlockedViewer: boolean;
  participants: ParticipantWithUser[];
  messages: MessageWithAuthor[];
}): DirectConversationDetail {
  return directConversationDetailSchema.parse({
    conversation: {
      id: args.conversationId,
      retentionMode: args.retentionMode,
      retentionSeconds: args.retentionSeconds,
      isBlockedByViewer: args.isBlockedByViewer,
      hasBlockedViewer: args.hasBlockedViewer,
      participants: args.participants.map((participant) => ({
        user: toPublicUser(participant.user),
        notificationSetting: participant.notificationSetting,
        lastReadMessageId: participant.lastReadMessageId,
        lastReadAt: participant.lastReadAt?.toISOString() ?? null,
      })),
      messages: args.messages.map((message) => toDirectMessage(message)),
    },
  });
}
