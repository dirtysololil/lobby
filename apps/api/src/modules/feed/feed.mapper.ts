import { feedPostSchema, type FeedPost } from '@lobby/shared';
import type { FeedPost as PrismaFeedPost } from '@prisma/client';
import { toPublicUser, type PublicUserRecord } from '../auth/auth.mapper';

type FeedPostRecord = PrismaFeedPost & {
  author: PublicUserRecord;
};

export function toFeedPost(post: FeedPostRecord): FeedPost {
  return feedPostSchema.parse({
    id: post.id,
    kind: post.kind,
    title: post.title,
    body: post.body,
    mediaUrl: post.mediaUrl,
    author: toPublicUser(post.author),
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
  });
}
