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
} from '@prisma/client';
import { toPublicUser, type PublicUserRecord } from '../auth/auth.mapper';

type TagRecord = Pick<PrismaForumTag, 'id' | 'name' | 'slug'>;

type TopicRecord = PrismaForumTopic & {
  author: PublicUserRecord;
  tags: Array<{
    tag: TagRecord;
  }>;
  _count: {
    replies: number;
  };
};

type ReplyRecord = PrismaForumReply & {
  author: PublicUserRecord;
};

export function toForumTopic(topic: TopicRecord): ForumTopic {
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
