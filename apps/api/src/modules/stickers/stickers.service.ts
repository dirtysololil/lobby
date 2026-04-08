import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreateStickerPackInput,
  ReorderStickerPacksInput,
  ReorderStickersInput,
  StickerAsset,
  StickerCatalog,
  StickerPack,
  UpdateStickerInput,
  UpdateStickerPackInput,
} from '@lobby/shared';
import { Prisma, Sticker, StickerType } from '@prisma/client';
import type { RequestMetadata } from '../../common/interfaces/request-metadata.interface';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EnvService } from '../env/env.service';
import { StorageService } from '../storage/storage.service';
import {
  processStickerUpload,
  type StickerCropTransform,
} from '../storage/sticker-media.util';
import {
  toStickerAsset,
  toStickerCatalog,
  toStickerPack,
  type StickerPackWithStickers,
  type StickerRecentRecord,
} from './stickers.mapper';

type PrismaLike = Prisma.TransactionClient | PrismaService;
type UploadedBinaryFile = {
  buffer: Buffer;
  size: number;
  originalname: string;
  mimetype?: string;
};

const recentStickerLimit = 24;

@Injectable()
export class StickersService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly envService: EnvService,
    private readonly storageService: StorageService,
  ) {}

  public async getCatalogForUser(userId: string): Promise<StickerCatalog> {
    const [packs, recent] = await Promise.all([
      this.prisma.stickerPack.findMany({
        where: {
          deletedAt: null,
          archivedAt: null,
          ...this.getPublishedPackWhere(),
          stickers: {
            some: {
              deletedAt: null,
              archivedAt: null,
              ...this.getPublishedStickerWhere(),
            },
          },
        },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        include: {
          stickers: {
            where: {
              deletedAt: null,
              archivedAt: null,
              ...this.getPublishedStickerWhere(),
            },
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          },
        },
      }),
      this.prisma.stickerRecent.findMany({
        where: {
          userId,
          sticker: {
            is: {
              deletedAt: null,
              archivedAt: null,
              ...this.getPublishedStickerWhere(),
            },
          },
          pack: {
            is: {
              deletedAt: null,
              archivedAt: null,
              ...this.getPublishedPackWhere(),
            },
          },
        },
        orderBy: [{ usedAt: 'desc' }],
        take: recentStickerLimit,
        include: {
          pack: true,
          sticker: true,
        },
      }),
    ]);

    return toStickerCatalog({
      packs: packs as StickerPackWithStickers[],
      recent: recent as StickerRecentRecord[],
    });
  }

  public async listAdminPacks(): Promise<StickerPack[]> {
    const packs = await this.prisma.stickerPack.findMany({
      where: {
        deletedAt: null,
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        stickers: {
          where: {
            deletedAt: null,
          },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });

    return packs.map((pack) => toStickerPack(pack as StickerPackWithStickers));
  }

  public async createPack(
    actorUserId: string,
    input: CreateStickerPackInput,
    requestMetadata: RequestMetadata,
  ): Promise<StickerPack> {
    const sortOrder = await this.getNextPackSortOrder();
    const published = input.published === true;
    let pack;

    try {
      pack = await this.prisma.stickerPack.create({
        data: {
          ownerId: actorUserId,
          title: input.title.trim(),
          slug: this.resolvePackSlug(input.slug, input.title),
          description: input.description?.trim() || null,
          sortOrder,
          isActive: published,
          publishedAt: published ? new Date() : null,
        },
        include: {
          stickers: {
            where: {
              deletedAt: null,
            },
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          },
        },
      });
    } catch (error) {
      this.rethrowKnownError(error, 'Слаг набора уже занят.');
    }

    await this.auditService.write({
      action: 'stickers.pack.create',
      entityType: 'StickerPack',
      entityId: pack.id,
      actorUserId,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      metadata: {
        title: pack.title,
        slug: pack.slug,
        published: published,
      },
    });

    return toStickerPack(pack as StickerPackWithStickers);
  }

  public async updatePack(
    actorUserId: string,
    packId: string,
    input: UpdateStickerPackInput,
    requestMetadata: RequestMetadata,
  ): Promise<StickerPack> {
    const currentPack = await this.prisma.stickerPack.findFirst({
      where: {
        id: packId,
        deletedAt: null,
      },
      select: {
        id: true,
        title: true,
      },
    });

    if (!currentPack) {
      throw new NotFoundException('Набор стикеров не найден.');
    }

    if (input.coverStickerId) {
      await this.getStickerOrThrow(packId, input.coverStickerId);
    }

    let pack;

    try {
      pack = await this.prisma.stickerPack.update({
        where: {
          id: packId,
        },
        data: {
          ...(input.title !== undefined ? { title: input.title.trim() } : {}),
          ...(input.slug !== undefined
            ? {
                slug: this.resolvePackSlug(
                  input.slug,
                  input.title ?? currentPack.title,
                ),
              }
            : {}),
          ...(input.description !== undefined
            ? { description: input.description?.trim() || null }
            : {}),
          ...(input.coverStickerId !== undefined
            ? { coverStickerId: input.coverStickerId }
            : {}),
          ...this.buildPackLifecycleUpdate(input),
        },
        include: {
          stickers: {
            where: {
              deletedAt: null,
            },
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          },
        },
      });
    } catch (error) {
      this.rethrowKnownError(error, 'Слаг набора уже занят.');
    }

    await this.auditService.write({
      action: 'stickers.pack.update',
      entityType: 'StickerPack',
      entityId: pack.id,
      actorUserId,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      metadata: {
        title: input.title ?? null,
        slug: input.slug ?? null,
        description: input.description ?? null,
        coverStickerId: input.coverStickerId ?? null,
        isActive: input.isActive ?? null,
        published: input.published ?? null,
        archived: input.archived ?? null,
      },
    });

    return toStickerPack(pack as StickerPackWithStickers);
  }

  public async reorderPacks(
    actorUserId: string,
    input: ReorderStickerPacksInput,
    requestMetadata: RequestMetadata,
  ): Promise<void> {
    const packs = await this.prisma.stickerPack.findMany({
      where: {
        deletedAt: null,
      },
      select: {
        id: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    const currentIds = packs.map((pack) => pack.id);
    const nextIds = input.packIds;

    if (
      currentIds.length !== nextIds.length ||
      currentIds.some((id) => !nextIds.includes(id))
    ) {
      throw new BadRequestException(
        'Список наборов для сортировки некорректен.',
      );
    }

    await this.prisma.$transaction(
      nextIds.map((packId, index) =>
        this.prisma.stickerPack.update({
          where: {
            id: packId,
          },
          data: {
            sortOrder: index,
          },
        }),
      ),
    );

    await this.auditService.write({
      action: 'stickers.pack.reorder',
      entityType: 'StickerPack',
      entityId: null,
      actorUserId,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      metadata: {
        packIds: nextIds,
      },
    });
  }

  public async deletePack(
    actorUserId: string,
    packId: string,
    requestMetadata: RequestMetadata,
  ): Promise<void> {
    await this.getPackOrThrow(packId);
    const deletedAt = new Date();

    await this.prisma.$transaction(async (transaction) => {
      await transaction.stickerPack.update({
        where: {
          id: packId,
        },
        data: {
          deletedAt,
          isActive: false,
          publishedAt: null,
          archivedAt: deletedAt,
        },
      });

      await transaction.sticker.updateMany({
        where: {
          packId,
          deletedAt: null,
        },
        data: {
          deletedAt,
          isActive: false,
          publishedAt: null,
          archivedAt: deletedAt,
        },
      });
    });

    await this.auditService.write({
      action: 'stickers.pack.delete',
      entityType: 'StickerPack',
      entityId: packId,
      actorUserId,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
    });
  }

  public async addStickerToPack(
    actorUserId: string,
    packId: string,
    file: UploadedBinaryFile | undefined,
    rawTitle: string | null | undefined,
    rawKeywords: string[] | null | undefined,
    crop: Partial<StickerCropTransform> | null | undefined,
    published: boolean | null | undefined,
    requestMetadata: RequestMetadata,
  ): Promise<StickerAsset> {
    await this.getPackOrThrow(packId);

    if (!file || !file.buffer || file.size === 0) {
      throw new BadRequestException('Выберите файл стикера.');
    }

    const env = this.envService.getValues();
    const maxBytes = Math.floor(env.MAX_STICKER_MB * 1024 * 1024);
    const isPublished = published === true;
    const keywords = this.resolveKeywords(rawKeywords);
    const sortOrder = await this.getNextStickerSortOrder(packId);
    const title = this.resolveStickerTitle(rawTitle, file.originalname, sortOrder);
    let processed;

    try {
      processed = await processStickerUpload({
        buffer: file.buffer,
        originalName: file.originalname,
        mimeType: file.mimetype,
        limits: {
          maxBytes,
          maxDimension: env.MAX_STICKER_DIMENSION,
          maxDurationMs: env.MAX_STICKER_ANIMATION_MS,
        },
        crop,
      });
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : 'Не удалось обработать файл стикера.',
      );
    }

    const sourceFileKey = await this.storageService.writeSticker(
      file.buffer,
      processed.metadata.extension,
    );
    const fileKey = await this.storageService.writeSticker(
      processed.staticBuffer,
      processed.staticExtension,
    );
    const animatedFileKey = processed.animatedBuffer
      ? await this.storageService.writeSticker(
          processed.animatedBuffer,
          processed.animatedExtension ?? 'webp',
        )
      : null;

    try {
      const sticker = await this.prisma.sticker.create({
        data: {
          packId,
          title,
          fileKey,
          animatedFileKey,
          animatedMimeType: processed.animatedMimeType,
          originalName: file.originalname || null,
          mimeType: processed.staticMimeType,
          fileSize: processed.staticBuffer.byteLength,
          sourceFileKey,
          sourceMimeType: processed.metadata.mimeType,
          sourceFileSize: file.size,
          width: 224,
          height: 224,
          type: processed.metadata.isAnimated
            ? StickerType.ANIMATED
            : StickerType.STATIC,
          isAnimated: processed.metadata.isAnimated,
          durationMs: processed.metadata.durationMs,
          keywords,
          searchText: [title, ...keywords].join(' ').trim(),
          sortOrder,
          isActive: isPublished,
          publishedAt: isPublished ? new Date() : null,
        },
      });

      await this.prisma.stickerPack.updateMany({
        where: {
          id: packId,
          coverStickerId: null,
        },
        data: {
          coverStickerId: sticker.id,
        },
      });

      await this.auditService.write({
        action: 'stickers.sticker.create',
        entityType: 'Sticker',
        entityId: sticker.id,
        actorUserId,
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
        metadata: {
          packId,
          mimeType: processed.metadata.mimeType,
          bytes: file.size,
          isAnimated: processed.metadata.isAnimated,
          keywords,
          published: isPublished,
        },
      });

      return toStickerAsset(sticker);
    } catch (error) {
      await this.storageService.deleteObject(fileKey);
      await this.storageService.deleteObject(animatedFileKey);
      await this.storageService.deleteObject(sourceFileKey);
      this.rethrowKnownError(error, 'Не удалось сохранить стикер.');
      throw error;
    }
  }

  public async updateSticker(
    actorUserId: string,
    packId: string,
    stickerId: string,
    input: UpdateStickerInput,
    requestMetadata: RequestMetadata,
  ): Promise<StickerAsset> {
    await this.getPackOrThrow(packId);
    const currentSticker = await this.prisma.sticker.findFirst({
      where: {
        id: stickerId,
        packId,
      },
      select: {
        id: true,
        title: true,
        keywords: true,
      },
    });

    if (!currentSticker) {
      throw new NotFoundException('Стикер не найден.');
    }

    const sticker = await this.prisma.sticker.update({
      where: {
        id: stickerId,
      },
      data: {
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(input.title !== undefined && input.keywords === undefined
          ? {
              searchText: [
                input.title.trim(),
                ...this.resolveKeywords(
                  Array.isArray(currentSticker.keywords)
                    ? currentSticker.keywords.filter(
                        (item): item is string => typeof item === 'string',
                      )
                    : [],
                ),
              ]
                .join(' ')
                .trim(),
            }
          : {}),
        ...(input.keywords !== undefined
          ? {
              keywords: this.resolveKeywords(input.keywords),
              searchText: [
                input.title?.trim() ?? currentSticker.title,
                ...this.resolveKeywords(input.keywords),
              ]
                .join(' ')
                .trim(),
            }
          : {}),
        ...this.buildStickerLifecycleUpdate(input),
      },
    });

    await this.auditService.write({
      action: 'stickers.sticker.update',
      entityType: 'Sticker',
      entityId: stickerId,
      actorUserId,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      metadata: {
        title: input.title ?? null,
        keywords: input.keywords ?? null,
        isActive: input.isActive ?? null,
        published: input.published ?? null,
        archived: input.archived ?? null,
      },
    });

    return toStickerAsset(sticker);
  }

  public async reorderStickers(
    actorUserId: string,
    packId: string,
    input: ReorderStickersInput,
    requestMetadata: RequestMetadata,
  ): Promise<void> {
    await this.getPackOrThrow(packId);

    const stickers = await this.prisma.sticker.findMany({
      where: {
        packId,
        deletedAt: null,
      },
      select: {
        id: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    const currentIds = stickers.map((sticker) => sticker.id);
    const nextIds = input.stickerIds;

    if (
      currentIds.length !== nextIds.length ||
      currentIds.some((id) => !nextIds.includes(id))
    ) {
      throw new BadRequestException(
        'Список стикеров для сортировки некорректен.',
      );
    }

    await this.prisma.$transaction(
      nextIds.map((stickerId, index) =>
        this.prisma.sticker.update({
          where: {
            id: stickerId,
          },
          data: {
            sortOrder: index,
          },
        }),
      ),
    );

    await this.auditService.write({
      action: 'stickers.sticker.reorder',
      entityType: 'StickerPack',
      entityId: packId,
      actorUserId,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      metadata: {
        stickerIds: nextIds,
      },
    });
  }

  public async deleteSticker(
    actorUserId: string,
    packId: string,
    stickerId: string,
    requestMetadata: RequestMetadata,
  ): Promise<void> {
    await this.getPackOrThrow(packId);
    const sticker = await this.getStickerOrThrow(packId, stickerId);

    if (!sticker.deletedAt) {
      await this.prisma.sticker.update({
        where: {
          id: stickerId,
        },
        data: {
          deletedAt: new Date(),
          isActive: false,
          publishedAt: null,
          archivedAt: new Date(),
        },
      });
    }

    await this.auditService.write({
      action: 'stickers.sticker.delete',
      entityType: 'Sticker',
      entityId: stickerId,
      actorUserId,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      metadata: {
        packId,
      },
    });
  }

  public async getActiveStickerOrThrow(stickerId: string): Promise<Sticker> {
    const sticker = await this.prisma.sticker.findFirst({
      where: {
        id: stickerId,
        deletedAt: null,
        archivedAt: null,
        ...this.getPublishedStickerWhere(),
        pack: {
          is: {
            deletedAt: null,
            archivedAt: null,
            ...this.getPublishedPackWhere(),
          },
        },
      },
    });

    if (!sticker) {
      throw new NotFoundException('Стикер недоступен.');
    }

    return sticker;
  }

  public async recordStickerUsage(
    userId: string,
    stickerId: string,
    packId: string,
    client?: PrismaLike,
  ): Promise<void> {
    const db = client ?? this.prisma;

    await db.stickerRecent.upsert({
      where: {
        userId_stickerId: {
          userId,
          stickerId,
        },
      },
      create: {
        userId,
        stickerId,
        packId,
        usedAt: new Date(),
        usageCount: 1,
      },
      update: {
        packId,
        usedAt: new Date(),
        usageCount: {
          increment: 1,
        },
      },
    });
  }

  public async getStickerAssetForViewer(
    _viewerId: string,
    stickerId: string,
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    const sticker = await this.prisma.sticker.findUnique({
      where: {
        id: stickerId,
      },
      select: {
        fileKey: true,
        mimeType: true,
        animatedFileKey: true,
        animatedMimeType: true,
      },
    });

    if (!sticker) {
      throw new NotFoundException('Стикер не найден.');
    }

    try {
      return {
        buffer: await this.storageService.readObject(
          sticker.animatedFileKey ?? sticker.fileKey,
        ),
        mimeType: sticker.animatedMimeType ?? sticker.mimeType,
      };
    } catch {
      throw new NotFoundException('Файл стикера недоступен.');
    }
  }

  private async getPackOrThrow(packId: string) {
    const pack = await this.prisma.stickerPack.findFirst({
      where: {
        id: packId,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!pack) {
      throw new NotFoundException('Набор стикеров не найден.');
    }

    return pack;
  }

  private async getStickerOrThrow(packId: string, stickerId: string) {
    const sticker = await this.prisma.sticker.findFirst({
      where: {
        id: stickerId,
        packId,
      },
      select: {
        id: true,
        deletedAt: true,
      },
    });

    if (!sticker) {
      throw new NotFoundException('Стикер не найден.');
    }

    return sticker;
  }

  private async getNextPackSortOrder(): Promise<number> {
    const aggregate = await this.prisma.stickerPack.aggregate({
      where: {
        deletedAt: null,
      },
      _max: {
        sortOrder: true,
      },
    });

    return (aggregate._max.sortOrder ?? -1) + 1;
  }

  private async getNextStickerSortOrder(packId: string): Promise<number> {
    const aggregate = await this.prisma.sticker.aggregate({
      where: {
        packId,
        deletedAt: null,
      },
      _max: {
        sortOrder: true,
      },
    });

    return (aggregate._max.sortOrder ?? -1) + 1;
  }

  private resolveStickerTitle(
    rawTitle: string | null | undefined,
    originalName: string | null | undefined,
    sortOrder: number,
  ): string {
    const explicitTitle = rawTitle?.trim();

    if (explicitTitle) {
      return explicitTitle.slice(0, 80);
    }

    const normalizedName = originalName?.trim() ?? '';
    const baseName =
      normalizedName.lastIndexOf('.') > 0
        ? normalizedName.slice(0, normalizedName.lastIndexOf('.'))
        : normalizedName;
    const cleanedName = baseName.trim().slice(0, 80);

    if (cleanedName) {
      return cleanedName;
    }

    return `Стикер ${sortOrder + 1}`;
  }

  private resolvePackSlug(
    rawSlug: string | null | undefined,
    rawTitle: string | null | undefined,
  ): string {
    const candidate = (rawSlug?.trim() || rawTitle?.trim() || 'sticker-pack')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120);

    if (!candidate || candidate.length < 2) {
      throw new BadRequestException('Укажите корректный slug набора.');
    }

    return candidate;
  }

  private resolveKeywords(value: string[] | null | undefined): string[] {
    if (!value || value.length === 0) {
      return [];
    }

    return [...new Set(value.map((item) => item.trim()).filter(Boolean))].slice(0, 24);
  }

  private getPublishedPackWhere(): Prisma.StickerPackWhereInput {
    return {
      OR: [
        {
          publishedAt: {
            not: null,
          },
        },
        {
          publishedAt: null,
          isActive: true,
        },
      ],
    };
  }

  private getPublishedStickerWhere(): Prisma.StickerWhereInput {
    return {
      OR: [
        {
          publishedAt: {
            not: null,
          },
        },
        {
          publishedAt: null,
          isActive: true,
        },
      ],
    };
  }

  private buildPackLifecycleUpdate(
    input: UpdateStickerPackInput,
  ): Prisma.StickerPackUpdateInput {
    const now = new Date();
    const update: Prisma.StickerPackUpdateInput = {};

    if (input.archived === true) {
      update.archivedAt = now;
      update.publishedAt = null;
      update.isActive = false;
      return update;
    }

    if (input.archived === false) {
      update.archivedAt = null;
    }

    if (input.published === true || input.isActive === true) {
      update.publishedAt = now;
      update.archivedAt = null;
      update.isActive = true;
      return update;
    }

    if (input.published === false || input.isActive === false) {
      update.publishedAt = null;
      update.isActive = false;
    }

    return update;
  }

  private buildStickerLifecycleUpdate(
    input: UpdateStickerInput,
  ): Prisma.StickerUpdateInput {
    const now = new Date();
    const update: Prisma.StickerUpdateInput = {};

    if (input.archived === true) {
      update.archivedAt = now;
      update.publishedAt = null;
      update.isActive = false;
      return update;
    }

    if (input.archived === false) {
      update.archivedAt = null;
    }

    if (input.published === true || input.isActive === true) {
      update.publishedAt = now;
      update.archivedAt = null;
      update.isActive = true;
      return update;
    }

    if (input.published === false || input.isActive === false) {
      update.publishedAt = null;
      update.isActive = false;
    }

    return update;
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
