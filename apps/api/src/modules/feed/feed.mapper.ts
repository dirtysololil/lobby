import { feedPostSchema, type FeedPost } from '@lobby/shared';
import type {
  FeedPost as PrismaFeedPost,
  FeedPostReaction as PrismaFeedPostReaction,
} from '@prisma/client';
import { toContentReactions } from '../../common/utils/content-reactions.util';
import { toPublicUser, type PublicUserRecord } from '../auth/auth.mapper';

type FeedPostRecord = PrismaFeedPost & {
  author: PublicUserRecord;
  reactions: Array<Pick<PrismaFeedPostReaction, 'emoji' | 'userId'>>;
};

export function toFeedPost(
  post: FeedPostRecord,
  viewerId?: string | null,
): FeedPost {
  return feedPostSchema.parse({
    id: post.id,
    kind: post.kind,
    title: post.title,
    body: post.body,
    mediaUrl: post.mediaUrl,
    author: toPublicUser(post.author),
    reactions: toContentReactions(post.reactions, viewerId),
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
  });
}
