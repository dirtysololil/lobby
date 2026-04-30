import {
  forumReplySchema,
  forumTopicSchema,
  type ForumReply,
  type ForumTopic,
} from '@lobby/shared';
import type {
  ForumReply as PrismaForumReply,
  ForumTag as PrismaForumTag,
  ForumTopic as PrismaForumTopic,
  ForumTopicReaction as PrismaForumTopicReaction,
} from '@prisma/client';
import { toContentReactions } from '../../common/utils/content-reactions.util';
import { toPublicUser, type PublicUserRecord } from '../auth/auth.mapper';

type TagRecord = Pick<PrismaForumTag, 'id' | 'name' | 'slug'>;

type TopicRecord = PrismaForumTopic & {
  author: PublicUserRecord;
  tags: Array<{
    tag: TagRecord;
  }>;
  reactions: Array<Pick<PrismaForumTopicReaction, 'emoji' | 'userId'>>;
  _count: {
    replies: number;
  };
};

type ReplyRecord = PrismaForumReply & {
  author: PublicUserRecord;
};

export function toForumTopic(
  topic: TopicRecord,
  viewerId?: string | null,
): ForumTopic {
  return forumTopicSchema.parse({
    id: topic.id,
    hubId: topic.hubId,
    lobbyId: topic.lobbyId,
    title: topic.title,
    content: topic.content,
    pinned: topic.pinned,
    locked: topic.locked,
    archived: topic.archived,
    createdAt: topic.createdAt.toISOString(),
    updatedAt: topic.updatedAt.toISOString(),
    lastActivityAt: topic.lastActivityAt.toISOString(),
    author: toPublicUser(topic.author),
    tags: topic.tags.map(({ tag }) => ({
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
    })),
    repliesCount: topic._count.replies,
    reactions: toContentReactions(topic.reactions, viewerId),
  });
}

export function toForumReply(reply: ReplyRecord): ForumReply {
  return forumReplySchema.parse({
    id: reply.id,
    topicId: reply.topicId,
    content: reply.content,
    createdAt: reply.createdAt.toISOString(),
    updatedAt: reply.updatedAt.toISOString(),
    author: toPublicUser(reply.author),
  });
}
