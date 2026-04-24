import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
import { EnvService } from '../env/env.service';
import { StorageService } from '../storage/storage.service';
import { processDirectMessageAttachmentUpload } from '../storage/direct-message-attachment.util';
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
    private readonly envService: EnvService,
    private readonly storageService: StorageService,
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
        body: input.body?.trim() ?? '',
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

  public async uploadPostMedia(
    file:
      | {
          buffer: Buffer;
          size: number;
          originalname: string;
          mimetype?: string;
        }
      | undefined,
  ) {
    if (!file?.buffer || file.size === 0) {
      throw new BadRequestException('Выберите фото, GIF или видео.');
    }

    try {
      const env = this.envService.getValues();
      const processed = await processDirectMessageAttachmentUpload({
        buffer: file.buffer,
        originalName: file.originalname,
        mimeType: file.mimetype,
        limits: {
          maxBytes: Math.floor(env.MAX_FILE_MB * 1024 * 1024),
          maxImageDimension: 6_000,
          maxVideoDimension: 3_840,
          maxVideoDurationMs: 5 * 60 * 1_000,
        },
      });

      if (processed.kind !== 'IMAGE' && processed.kind !== 'VIDEO') {
        throw new BadRequestException(
          'В пост можно загрузить фото, GIF или видео.',
        );
      }

      const fileKey = await this.storageService.writeFeedMedia(
        processed.assetBuffer,
        processed.extension,
      );

      return {
        kind: processed.kind,
        mediaUrl: `/v1/feed/media/${encodeMediaKey(fileKey)}`,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException(
        error instanceof Error ? error.message : 'Не удалось загрузить медиа.',
      );
    }
  }

  public async readPostMedia(mediaKey: string) {
    const fileKey = decodeMediaKey(mediaKey);

    if (!fileKey.startsWith('feed-media/')) {
      throw new NotFoundException('Media not found');
    }

    return {
      buffer: await this.storageService.readObject(fileKey),
      mimeType: resolveMediaMimeType(fileKey),
    };
  }
}

function encodeMediaKey(fileKey: string) {
  return Buffer.from(fileKey, 'utf8').toString('base64url');
}

function decodeMediaKey(mediaKey: string) {
  try {
    return Buffer.from(mediaKey, 'base64url').toString('utf8');
  } catch {
    throw new NotFoundException('Media not found');
  }
}

function resolveMediaMimeType(fileKey: string) {
  const extension = fileKey.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'mp4':
      return 'video/mp4';
    case 'webm':
      return 'video/webm';
    default:
      return 'application/octet-stream';
  }
}
