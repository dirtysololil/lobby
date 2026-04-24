import { Injectable } from '@nestjs/common';
import {
  type CreateFeedPostInput,
  type FeedPost,
  type PublicUser,
} from '@lobby/shared';
import { FeedPostKind, Prisma } from '@prisma/client';
import type { RequestMetadata } from '../../common/interfaces/request-metadata.interface';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { publicUserSelect } from '../auth/auth.mapper';
import { toFeedPost } from './feed.mapper';

const feedPostInclude = {
  author: {
    select: publicUserSelect,
  },
} satisfies Prisma.FeedPostInclude;

@Injectable()
export class FeedService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  public async listPosts(): Promise<FeedPost[]> {
    const posts = await this.prisma.feedPost.findMany({
      where: {
        deletedAt: null,
        author: {
          platformBlock: null,
        },
      },
      include: feedPostInclude,
      orderBy: {
        createdAt: 'desc',
      },
      take: 80,
    });

    return posts.map((post) => toFeedPost(post));
  }

  public async createPost(
    actor: PublicUser,
    input: CreateFeedPostInput,
    requestMetadata: RequestMetadata,
  ): Promise<FeedPost> {
    const kind =
      input.kind === 'VIDEO' ? FeedPostKind.VIDEO : FeedPostKind.ARTICLE;
    const post = await this.prisma.feedPost.create({
      data: {
        authorId: actor.id,
        kind,
        title: input.title?.trim() || null,
        body: input.body.trim(),
        mediaUrl: input.mediaUrl?.trim() || null,
      },
      include: feedPostInclude,
    });

    await this.auditService.write({
      action: 'feed.post.create',
      entityType: 'FeedPost',
      entityId: post.id,
      actorUserId: actor.id,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      metadata: {
        kind,
        hasMediaUrl: Boolean(post.mediaUrl),
      },
    });

    return toFeedPost(post);
  }
}
