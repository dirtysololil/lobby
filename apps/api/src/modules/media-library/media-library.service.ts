import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AdminMediaLibrary,
  CreateCustomEmojiInput,
  CreateGifAssetInput,
  CustomEmojiAsset,
  GifAsset,
  MediaPickerCatalog,
  ReorderCustomEmojisInput,
  ReorderGifAssetsInput,
  UpdateCustomEmojiInput,
  UpdateGifAssetInput,
} from '@lobby/shared';
import { Prisma } from '@prisma/client';
import type { RequestMetadata } from '../../common/interfaces/request-metadata.interface';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EnvService } from '../env/env.service';
import { StickersService } from '../stickers/stickers.service';
import { StorageService } from '../storage/storage.service';
import { parseStickerImageMetadata } from '../storage/sticker-image.util';
import {
  toAdminMediaLibrary,
  toCustomEmojiAsset,
  toGifAsset,
  toMediaPickerCatalog,
} from './media-library.mapper';

type UploadedBinaryFile = {
  buffer: Buffer;
  size: number;
  originalname: string;
};

@Injectable()
export class MediaLibraryService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly envService: EnvService,
    private readonly storageService: StorageService,
    private readonly stickersService: StickersService,
  ) {}

  public async getPickerCatalog(userId: string): Promise<MediaPickerCatalog> {
    const [customEmojis, gifs, stickers] = await Promise.all([
      this.prisma.customEmoji.findMany({
        where: {
          deletedAt: null,
          isActive: true,
        },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.gifAsset.findMany({
        where: {
          deletedAt: null,
          isActive: true,
        },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      }),
      this.stickersService.getCatalogForUser(userId),
    ]);

    return toMediaPickerCatalog({
      customEmojis,
      gifs,
      stickers,
    });
  }

  public async listAdminLibrary(): Promise<AdminMediaLibrary> {
    const [emojis, gifs, stickerPacks] = await Promise.all([
      this.prisma.customEmoji.findMany({
        where: {
          deletedAt: null,
        },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.gifAsset.findMany({
        where: {
          deletedAt: null,
        },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      }),
      this.stickersService.listAdminPacks(),
    ]);

    return toAdminMediaLibrary({
      emojis,
      gifs,
      stickerPacks,
    });
  }

  public async createCustomEmoji(
    actorUserId: string,
    input: CreateCustomEmojiInput,
    file: UploadedBinaryFile | undefined,
    requestMetadata: RequestMetadata,
  ): Promise<CustomEmojiAsset> {
    if (!file || !file.buffer || file.size === 0) {
      throw new BadRequestException('Выберите файл смайлика.');
    }

    const env = this.envService.getValues();
    const maxBytes = Math.floor(env.MAX_CUSTOM_EMOJI_MB * 1024 * 1024);

    if (file.size > maxBytes) {
      throw new BadRequestException(
        `Смайлик слишком большой. Максимальный размер: ${env.MAX_CUSTOM_EMOJI_MB} MB.`,
      );
    }

    const metadata = this.parseVisualMetadata(file.buffer, {
      maxFrames: env.MAX_GIF_FRAMES,
      maxAnimationMs: env.MAX_GIF_ANIMATION_MS,
      maxDimension: env.MAX_CUSTOM_EMOJI_DIMENSION,
      fallbackMessage: 'Не удалось обработать файл смайлика.',
    });

    const fileKey = await this.storageService.writeCustomEmoji(
      file.buffer,
      metadata.extension,
    );
    const sortOrder = await this.getNextCustomEmojiSortOrder();

    try {
      const emoji = await this.prisma.customEmoji.create({
        data: {
          alias: input.alias.trim().toLowerCase(),
          title: input.title?.trim() || input.alias.trim(),
          fileKey,
          originalName: file.originalname || null,
          mimeType: metadata.mimeType,
          fileSize: metadata.bytes,
          width: metadata.width,
          height: metadata.height,
          sortOrder,
          isActive: true,
          createdById: actorUserId,
        },
      });

      await this.auditService.write({
        action: 'media.emoji.create',
        entityType: 'CustomEmoji',
        entityId: emoji.id,
        actorUserId,
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
        metadata: {
          alias: emoji.alias,
          mimeType: emoji.mimeType,
        },
      });

      return toCustomEmojiAsset(emoji);
    } catch (error) {
      await this.storageService.deleteObject(fileKey);
      this.rethrowKnownError(error, 'Этот alias уже занят.');
    }
  }

  public async updateCustomEmoji(
    actorUserId: string,
    emojiId: string,
    input: UpdateCustomEmojiInput,
    requestMetadata: RequestMetadata,
  ): Promise<CustomEmojiAsset> {
    await this.getCustomEmojiOrThrow(emojiId);

    try {
      const emoji = await this.prisma.customEmoji.update({
        where: {
          id: emojiId,
        },
        data: {
          ...(input.alias !== undefined
            ? { alias: input.alias.trim().toLowerCase() }
            : {}),
          ...(input.title !== undefined ? { title: input.title.trim() } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
      });

      await this.auditService.write({
        action: 'media.emoji.update',
        entityType: 'CustomEmoji',
        entityId: emojiId,
        actorUserId,
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
        metadata: {
          alias: input.alias ?? null,
          title: input.title ?? null,
          isActive: input.isActive ?? null,
        },
      });

      return toCustomEmojiAsset(emoji);
    } catch (error) {
      this.rethrowKnownError(error, 'Этот alias уже занят.');
    }
  }

  public async reorderCustomEmojis(
    actorUserId: string,
    input: ReorderCustomEmojisInput,
    requestMetadata: RequestMetadata,
  ): Promise<void> {
    const items = await this.prisma.customEmoji.findMany({
      where: {
        deletedAt: null,
      },
      select: {
        id: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    const currentIds = items.map((item) => item.id);

    if (
      currentIds.length !== input.emojiIds.length ||
      currentIds.some((id) => !input.emojiIds.includes(id))
    ) {
      throw new BadRequestException('Список смайликов для сортировки некорректен.');
    }

    await this.prisma.$transaction(
      input.emojiIds.map((emojiId, index) =>
        this.prisma.customEmoji.update({
          where: {
            id: emojiId,
          },
          data: {
            sortOrder: index,
          },
        }),
      ),
    );

    await this.auditService.write({
      action: 'media.emoji.reorder',
      entityType: 'CustomEmoji',
      entityId: null,
      actorUserId,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      metadata: {
        emojiIds: input.emojiIds,
      },
    });
  }

  public async deleteCustomEmoji(
    actorUserId: string,
    emojiId: string,
    requestMetadata: RequestMetadata,
  ): Promise<void> {
    await this.getCustomEmojiOrThrow(emojiId);

    await this.prisma.customEmoji.update({
      where: {
        id: emojiId,
      },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });

    await this.auditService.write({
      action: 'media.emoji.delete',
      entityType: 'CustomEmoji',
      entityId: emojiId,
      actorUserId,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
    });
  }

  public async createGifAsset(
    actorUserId: string,
    input: CreateGifAssetInput,
    file: UploadedBinaryFile | undefined,
    requestMetadata: RequestMetadata,
  ): Promise<GifAsset> {
    if (!file || !file.buffer || file.size === 0) {
      throw new BadRequestException('Выберите GIF или изображение.');
    }

    const env = this.envService.getValues();
    const maxBytes = Math.floor(env.MAX_GIF_MB * 1024 * 1024);

    if (file.size > maxBytes) {
      throw new BadRequestException(
        `GIF слишком большой. Максимальный размер: ${env.MAX_GIF_MB} MB.`,
      );
    }

    const metadata = this.parseVisualMetadata(file.buffer, {
      maxFrames: env.MAX_GIF_FRAMES,
      maxAnimationMs: env.MAX_GIF_ANIMATION_MS,
      maxDimension: env.MAX_GIF_DIMENSION,
      fallbackMessage: 'Не удалось обработать файл GIF.',
    });
    const fileKey = await this.storageService.writeGif(
      file.buffer,
      metadata.extension,
    );
    const sortOrder = await this.getNextGifSortOrder();

    try {
      const gif = await this.prisma.gifAsset.create({
        data: {
          title: input.title.trim(),
          tags: input.tags,
          fileKey,
          previewKey: null,
          originalName: file.originalname || null,
          mimeType: metadata.mimeType,
          fileSize: metadata.bytes,
          width: metadata.width,
          height: metadata.height,
          durationMs: metadata.animationDurationMs,
          sortOrder,
          isActive: true,
          createdById: actorUserId,
        },
      });

      await this.auditService.write({
        action: 'media.gif.create',
        entityType: 'GifAsset',
        entityId: gif.id,
        actorUserId,
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
        metadata: {
          title: gif.title,
          tags: input.tags,
          mimeType: gif.mimeType,
        },
      });

      return toGifAsset(gif);
    } catch (error) {
      await this.storageService.deleteObject(fileKey);
      throw error;
    }
  }

  public async updateGifAsset(
    actorUserId: string,
    gifId: string,
    input: UpdateGifAssetInput,
    requestMetadata: RequestMetadata,
  ): Promise<GifAsset> {
    await this.getGifOrThrow(gifId);

    const gif = await this.prisma.gifAsset.update({
      where: {
        id: gifId,
      },
      data: {
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(input.tags !== undefined ? { tags: input.tags } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });

    await this.auditService.write({
      action: 'media.gif.update',
      entityType: 'GifAsset',
      entityId: gifId,
      actorUserId,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      metadata: {
        title: input.title ?? null,
        tags: input.tags ?? null,
        isActive: input.isActive ?? null,
      },
    });

    return toGifAsset(gif);
  }

  public async reorderGifAssets(
    actorUserId: string,
    input: ReorderGifAssetsInput,
    requestMetadata: RequestMetadata,
  ): Promise<void> {
    const items = await this.prisma.gifAsset.findMany({
      where: {
        deletedAt: null,
      },
      select: {
        id: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    const currentIds = items.map((item) => item.id);

    if (
      currentIds.length !== input.gifIds.length ||
      currentIds.some((id) => !input.gifIds.includes(id))
    ) {
      throw new BadRequestException('Список GIF для сортировки некорректен.');
    }

    await this.prisma.$transaction(
      input.gifIds.map((gifId, index) =>
        this.prisma.gifAsset.update({
          where: {
            id: gifId,
          },
          data: {
            sortOrder: index,
          },
        }),
      ),
    );

    await this.auditService.write({
      action: 'media.gif.reorder',
      entityType: 'GifAsset',
      entityId: null,
      actorUserId,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      metadata: {
        gifIds: input.gifIds,
      },
    });
  }

  public async deleteGifAsset(
    actorUserId: string,
    gifId: string,
    requestMetadata: RequestMetadata,
  ): Promise<void> {
    await this.getGifOrThrow(gifId);

    await this.prisma.gifAsset.update({
      where: {
        id: gifId,
      },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });

    await this.auditService.write({
      action: 'media.gif.delete',
      entityType: 'GifAsset',
      entityId: gifId,
      actorUserId,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
    });
  }

  public async getGifAssetForViewer(
    _viewerId: string,
    gifId: string,
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    const gif = await this.prisma.gifAsset.findUnique({
      where: {
        id: gifId,
      },
      select: {
        fileKey: true,
        mimeType: true,
      },
    });

    if (!gif) {
      throw new NotFoundException('GIF не найден.');
    }

    try {
      return {
        buffer: await this.storageService.readObject(gif.fileKey),
        mimeType: gif.mimeType,
      };
    } catch {
      throw new NotFoundException('Файл GIF недоступен.');
    }
  }

  public async getCustomEmojiAssetForViewer(
    _viewerId: string,
    emojiId: string,
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    const emoji = await this.prisma.customEmoji.findUnique({
      where: {
        id: emojiId,
      },
      select: {
        fileKey: true,
        mimeType: true,
      },
    });

    if (!emoji) {
      throw new NotFoundException('Смайлик не найден.');
    }

    try {
      return {
        buffer: await this.storageService.readObject(emoji.fileKey),
        mimeType: emoji.mimeType,
      };
    } catch {
      throw new NotFoundException('Файл смайлика недоступен.');
    }
  }

  public async getActiveGifOrThrow(gifId: string) {
    const gif = await this.prisma.gifAsset.findFirst({
      where: {
        id: gifId,
        deletedAt: null,
        isActive: true,
      },
    });

    if (!gif) {
      throw new NotFoundException('GIF недоступен.');
    }

    return gif;
  }

  private async getCustomEmojiOrThrow(emojiId: string) {
    const emoji = await this.prisma.customEmoji.findFirst({
      where: {
        id: emojiId,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!emoji) {
      throw new NotFoundException('Смайлик не найден.');
    }

    return emoji;
  }

  private async getGifOrThrow(gifId: string) {
    const gif = await this.prisma.gifAsset.findFirst({
      where: {
        id: gifId,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!gif) {
      throw new NotFoundException('GIF не найден.');
    }

    return gif;
  }

  private async getNextCustomEmojiSortOrder(): Promise<number> {
    const aggregate = await this.prisma.customEmoji.aggregate({
      where: {
        deletedAt: null,
      },
      _max: {
        sortOrder: true,
      },
    });

    return (aggregate._max.sortOrder ?? -1) + 1;
  }

  private async getNextGifSortOrder(): Promise<number> {
    const aggregate = await this.prisma.gifAsset.aggregate({
      where: {
        deletedAt: null,
      },
      _max: {
        sortOrder: true,
      },
    });

    return (aggregate._max.sortOrder ?? -1) + 1;
  }

  private parseVisualMetadata(
    buffer: Buffer,
    options: {
      maxFrames: number;
      maxAnimationMs: number;
      maxDimension: number;
      fallbackMessage: string;
    },
  ) {
    try {
      return parseStickerImageMetadata(buffer, {
        maxFrames: options.maxFrames,
        maxAnimationMs: options.maxAnimationMs,
        maxDimension: options.maxDimension,
      });
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : options.fallbackMessage,
      );
    }
  }

  private rethrowKnownError(error: unknown, duplicateMessage: string): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(duplicateMessage);
    }

    throw error;
  }
}
