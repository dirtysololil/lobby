import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreateStickerPackInput,
  ReorderStickerPacksInput,
  ReorderStickersInput,
  SetStickerPackCoverInput,
  StickerAsset,
  StickerCatalog,
  StickerPack,
  StickerPackDiscovery,
  UpdateStickerInput,
  UpdateStickerPackInput,
} from '@lobby/shared';
import {
  Prisma,
  Sticker,
  StickerPack as PrismaStickerPack,
  StickerType,
} from '@prisma/client';
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
  buildStickerPackSlug,
  buildStickerPackSlugVariant,
} from './sticker-pack-slug.util';
import {
  toStickerAsset,
  toStickerCatalog,
  toStickerPack,
  toStickerPackDiscovery,
  type StickerPackDiscoveryRecord,
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

type ResolvedPackState = {
  isActive: boolean;
  isPublished: boolean;
  isDiscoverable: boolean;
  isHidden: boolean;
  isArchived: boolean;
};

type ResolvedStickerState = {
  isActive: boolean;
  isPublished: boolean;
  isHidden: boolean;
  isArchived: boolean;
};

const recentStickerLimit = 24;
const discoverStickerLimit = 24;

@Injectable()
export class StickersService {
  private readonly logger = new Logger(StickersService.name);

  public constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly envService: EnvService,
    private readonly storageService: StorageService,
  ) {}

  public async getCatalogForUser(userId: string): Promise<StickerCatalog> {
    await this.ensureDefaultInstalledPacks(userId);

    const installedPacks = await this.prisma.userStickerPack.findMany({
      where: {
        userId,
      },
      select: {
        packId: true,
        sortOrder: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    const packIds = installedPacks.map((item) => item.packId);
    const packOrder = new Map(packIds.map((packId, index) => [packId, index]));

    const [packs, recent] = await Promise.all([
      packIds.length === 0
        ? Promise.resolve([] as StickerPackWithStickers[])
        : (this.prisma.stickerPack.findMany({
            where: {
              id: {
                in: packIds,
              },
              ...this.getCatalogPackWhere(),
              stickers: {
                some: this.getCatalogStickerWhere(),
              },
            },
            include: {
              stickers: {
                where: this.getCatalogStickerWhere(),
                orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
              },
            },
          }) as Promise<StickerPackWithStickers[]>),
      this.prisma.stickerRecent.findMany({
        where: {
          userId,
          packId: packIds.length > 0 ? { in: packIds } : undefined,
          sticker: {
            is: this.getCatalogStickerWhere(),
          },
          pack: {
            is: this.getCatalogPackWhere(),
          },
        },
        orderBy: [{ usedAt: 'desc' }],
        take: recentStickerLimit,
        include: {
          pack: true,
          sticker: true,
        },
      }) as Promise<StickerRecentRecord[]>,
    ]);

    const orderedPacks = [...packs].sort(
      (left, right) =>
        (packOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
        (packOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER),
    );

    return toStickerCatalog({
      packs: orderedPacks,
      recent,
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

  public async discoverPacks(
    userId: string,
    query: string,
  ): Promise<StickerPackDiscovery[]> {
    await this.ensureDefaultInstalledPacks(userId);

    const installedPacks = await this.prisma.userStickerPack.findMany({
      where: {
        userId,
      },
      select: {
        packId: true,
      },
    });
    const installedPackIds = new Set(installedPacks.map((item) => item.packId));
    const normalizedQuery = query.trim().toLowerCase();
    const rawQuery = query.trim();

    const packs = await this.prisma.stickerPack.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        isPublished: true,
        isDiscoverable: true,
        isHidden: false,
        isArchived: false,
        stickers: {
          some: {
            deletedAt: null,
            isActive: true,
            isPublished: true,
            isHidden: false,
            isArchived: false,
          },
        },
        ...(normalizedQuery
          ? {
              OR: [
                {
                  title: {
                    contains: rawQuery,
                  },
                },
                {
                  slug: {
                    contains: normalizedQuery,
                  },
                },
                {
                  description: {
                    contains: rawQuery,
                  },
                },
                {
                  stickers: {
                    some: {
                      deletedAt: null,
                      isActive: true,
                      isPublished: true,
                      isHidden: false,
                      isArchived: false,
                      searchText: {
                        contains: normalizedQuery,
                      },
                    },
                  },
                },
              ],
            }
          : {}),
      },
      include: {
        coverSticker: true,
        stickers: {
          where: {
            deletedAt: null,
            isActive: true,
            isPublished: true,
            isHidden: false,
            isArchived: false,
          },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      take: discoverStickerLimit,
    });

    return packs.map((pack) =>
      toStickerPackDiscovery(
        pack as StickerPackDiscoveryRecord,
        installedPackIds.has(pack.id),
      ),
    );
  }

  public async installPackForUser(userId: string, packId: string): Promise<void> {
    const pack = await this.prisma.stickerPack.findFirst({
      where: {
        id: packId,
        deletedAt: null,
        isActive: true,
        isPublished: true,
        isDiscoverable: true,
        isHidden: false,
        isArchived: false,
        stickers: {
          some: {
            deletedAt: null,
            isActive: true,
            isPublished: true,
            isHidden: false,
            isArchived: false,
          },
        },
      },
      select: {
        id: true,
      },
    });

    if (!pack) {
      throw new NotFoundException('Стикерпак недоступен для установки.');
    }

    const sortOrder = await this.getNextUserPackSortOrder(userId);

    await this.prisma.userStickerPack.upsert({
      where: {
        userId_packId: {
          userId,
          packId,
        },
      },
      create: {
        userId,
        packId,
        sortOrder,
      },
      update: {},
    });
  }

  public async uninstallPackForUser(userId: string, packId: string): Promise<void> {
    await this.prisma.userStickerPack.deleteMany({
      where: {
        userId,
        packId,
      },
    });
  }

  public async createPack(
    actorUserId: string,
    input: CreateStickerPackInput,
    requestMetadata: RequestMetadata,
  ): Promise<StickerPack> {
    const sortOrder = await this.getNextPackSortOrder();
    const nextState = this.resolvePackState(null, {
      isPublished: input.isPublished ?? input.published ?? false,
      isDiscoverable: input.isDiscoverable ?? false,
    });

    const pack = await this.prisma.$transaction(async (transaction) => {
      const created = await this.createPackWithGeneratedSlug(
        {
          actorUserId,
          title: input.title.trim(),
          description: input.description?.trim() || null,
          sortOrder,
          state: nextState,
        },
        transaction,
      );

      const userSortOrder = await this.getNextUserPackSortOrder(
        actorUserId,
        transaction,
      );

      await transaction.userStickerPack.upsert({
        where: {
          userId_packId: {
            userId: actorUserId,
            packId: created.id,
          },
        },
        create: {
          userId: actorUserId,
          packId: created.id,
          sortOrder: userSortOrder,
        },
        update: {},
      });

      return created;
    });

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
        isPublished: nextState.isPublished,
        isDiscoverable: nextState.isDiscoverable,
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
    const currentPack = await this.getPackOrThrow(packId);

    if (input.coverStickerId !== undefined && input.coverStickerId !== null) {
      const coverSticker = await this.getStickerOrThrow(packId, input.coverStickerId);

      if (coverSticker.deletedAt) {
        throw new BadRequestException('Deleted sticker cannot be used as pack cover.');
      }
    }

    const nextState = this.resolvePackState(currentPack, input);
    const pack = await this.prisma.stickerPack.update({
      where: {
        id: packId,
      },
      data: {
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(input.description !== undefined
          ? { description: input.description?.trim() || null }
          : {}),
        ...(input.coverStickerId !== undefined
          ? input.coverStickerId
            ? {
                coverSticker: {
                  connect: {
                    id: input.coverStickerId,
                  },
                },
              }
            : {
                coverSticker: {
                  disconnect: true,
                },
              }
          : {}),
        ...this.buildPackLifecycleUpdate(currentPack, nextState),
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

    await this.auditService.write({
      action: 'stickers.pack.update',
      entityType: 'StickerPack',
      entityId: pack.id,
      actorUserId,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      metadata: {
        title: input.title ?? null,
        slug: currentPack.slug,
        description: input.description ?? null,
        coverStickerId: input.coverStickerId ?? null,
        isActive: nextState.isActive,
        isPublished: nextState.isPublished,
        isDiscoverable: nextState.isDiscoverable,
        isHidden: nextState.isHidden,
        isArchived: nextState.isArchived,
      },
    });

    return toStickerPack(pack as StickerPackWithStickers);
  }

  public async setPackCover(
    actorUserId: string,
    packId: string,
    input: SetStickerPackCoverInput,
    requestMetadata: RequestMetadata,
  ): Promise<StickerPack> {
    return this.updatePack(
      actorUserId,
      packId,
      {
        coverStickerId: input.stickerId,
      },
      requestMetadata,
    );
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
          isPublished: false,
          isHidden: true,
          isArchived: true,
          publishedAt: null,
          archivedAt: deletedAt,
          coverSticker: {
            disconnect: true,
          },
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
          isPublished: false,
          isHidden: true,
          isArchived: true,
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
    const pack = await this.getPackOrThrow(packId);

    if (!file || !file.buffer || file.size === 0) {
      throw new BadRequestException('Sticker file is required.');
    }

    const env = this.envService.getValues();
    const maxBytes = Math.floor(env.MAX_STICKER_MB * 1024 * 1024);
    const nextState = this.resolveStickerState(null, {
      isPublished: published === true,
    });
    const keywords = this.normalizeKeywords(rawKeywords);
    const sortOrder = await this.getNextStickerSortOrder(packId);
    const title = this.resolveStickerTitle(rawTitle, file.originalname, sortOrder);
    let processed;

    try {
      this.logger.log(
        `Processing sticker upload for pack ${packId} (${file.originalname})`,
      );
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
      this.logger.warn(
        `Sticker upload failed for pack ${packId}: ${
          error instanceof Error ? error.message : 'UNKNOWN_ERROR'
        }`,
      );
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : 'Could not process sticker file.',
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
          type: processed.metadata.isAnimated
            ? StickerType.ANIMATED
            : StickerType.STATIC,
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
          isAnimated: processed.metadata.isAnimated,
          durationMs: processed.metadata.durationMs,
          keywords,
          searchText: this.buildStickerSearchText(
            title,
            keywords,
            file.originalname || null,
          ),
          sortOrder,
          ...this.buildStickerLifecycleCreateData(nextState),
        },
      });

      if (!pack.coverStickerId) {
        await this.prisma.stickerPack.update({
          where: {
            id: packId,
          },
          data: {
            coverSticker: {
              connect: {
                id: sticker.id,
              },
            },
          },
        });
      }

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
          isPublished: nextState.isPublished,
        },
      });

      this.logger.log(
        `Sticker ${sticker.id} created in pack ${packId} (${processed.metadata.isAnimated ? 'animated' : 'static'})`,
      );

      return toStickerAsset(sticker);
    } catch (error) {
      await this.storageService.deleteObject(fileKey);
      await this.storageService.deleteObject(animatedFileKey);
      await this.storageService.deleteObject(sourceFileKey);
      this.rethrowKnownError(error, 'Could not save sticker.');
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
    const currentSticker = await this.getStickerOrThrow(packId, stickerId);
    const nextState = this.resolveStickerState(currentSticker, input);
    const nextTitle = input.title?.trim() ?? currentSticker.title;
    const nextKeywords =
      input.keywords !== undefined
        ? this.normalizeKeywords(input.keywords)
        : this.normalizeKeywords(currentSticker.keywords);

    const sticker = await this.prisma.sticker.update({
      where: {
        id: stickerId,
      },
      data: {
        ...(input.title !== undefined ? { title: nextTitle } : {}),
        ...(input.keywords !== undefined ? { keywords: nextKeywords } : {}),
        searchText: this.buildStickerSearchText(
          nextTitle,
          nextKeywords,
          currentSticker.originalName,
        ),
        ...this.buildStickerLifecycleUpdate(currentSticker, nextState),
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
        isActive: nextState.isActive,
        isPublished: nextState.isPublished,
        isHidden: nextState.isHidden,
        isArchived: nextState.isArchived,
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
      await this.prisma.$transaction(async (transaction) => {
        await transaction.sticker.update({
          where: {
            id: stickerId,
          },
          data: {
            deletedAt: new Date(),
            isActive: false,
            isPublished: false,
            isHidden: true,
            isArchived: true,
            publishedAt: null,
            archivedAt: new Date(),
          },
        });

        const pack = await transaction.stickerPack.findUnique({
          where: {
            id: packId,
          },
          select: {
            coverStickerId: true,
          },
        });

        if (pack?.coverStickerId === stickerId) {
          const fallbackCover = await this.findFallbackCoverStickerId(
            packId,
            stickerId,
            transaction,
          );

          await transaction.stickerPack.update({
            where: {
              id: packId,
            },
            data: fallbackCover
              ? {
                  coverSticker: {
                    connect: {
                      id: fallbackCover,
                    },
                  },
                }
              : {
                  coverSticker: {
                    disconnect: true,
                  },
                },
          });
        }
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
        ...this.getCatalogStickerWhere(),
        pack: {
          is: this.getCatalogPackWhere(),
        },
      },
    });

    if (!sticker) {
      throw new NotFoundException('Sticker is not available.');
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

  private async ensureDefaultInstalledPacks(userId: string): Promise<void> {
    const existingCount = await this.prisma.userStickerPack.count({
      where: {
        userId,
      },
    });

    if (existingCount > 0) {
      return;
    }

    const bootstrapPacks = await this.prisma.stickerPack.findMany({
      where: {
        ...this.getCatalogPackWhere(),
        stickers: {
          some: this.getCatalogStickerWhere(),
        },
      },
      select: {
        id: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    if (bootstrapPacks.length === 0) {
      return;
    }

    await this.prisma.userStickerPack.createMany({
      data: bootstrapPacks.map((pack, index) => ({
        userId,
        packId: pack.id,
        sortOrder: index,
      })),
      skipDuplicates: true,
    });
  }

  private async getPackOrThrow(packId: string): Promise<PrismaStickerPack> {
    const pack = await this.prisma.stickerPack.findFirst({
      where: {
        id: packId,
        deletedAt: null,
      },
    });

    if (!pack) {
      throw new NotFoundException('Sticker pack not found.');
    }

    return pack;
  }

  private async getStickerOrThrow(packId: string, stickerId: string): Promise<Sticker> {
    const sticker = await this.prisma.sticker.findFirst({
      where: {
        id: stickerId,
        packId,
      },
    });

    if (!sticker) {
      throw new NotFoundException('Sticker not found.');
    }

    return sticker;
  }

  private async getNextPackSortOrder(client?: PrismaLike): Promise<number> {
    const aggregate = await (client ?? this.prisma).stickerPack.aggregate({
      where: {
        deletedAt: null,
      },
      _max: {
        sortOrder: true,
      },
    });

    return (aggregate._max.sortOrder ?? -1) + 1;
  }

  private async getNextUserPackSortOrder(
    userId: string,
    client?: PrismaLike,
  ): Promise<number> {
    const aggregate = await (client ?? this.prisma).userStickerPack.aggregate({
      where: {
        userId,
      },
      _max: {
        sortOrder: true,
      },
    });

    return (aggregate._max.sortOrder ?? -1) + 1;
  }

  private async getNextStickerSortOrder(
    packId: string,
    client?: PrismaLike,
  ): Promise<number> {
    const aggregate = await (client ?? this.prisma).sticker.aggregate({
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

  private async findFallbackCoverStickerId(
    packId: string,
    excludedStickerId: string | null,
    client: PrismaLike,
  ) {
    const sticker = await client.sticker.findFirst({
      where: {
        packId,
        deletedAt: null,
        ...(excludedStickerId
          ? {
              id: {
                not: excludedStickerId,
              },
            }
          : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
      },
    });

    return sticker?.id ?? null;
  }

  private resolvePackState(
    current: Pick<
      PrismaStickerPack,
      | 'isActive'
      | 'isPublished'
      | 'isDiscoverable'
      | 'isHidden'
      | 'isArchived'
      | 'publishedAt'
      | 'archivedAt'
    > | null,
    input: Partial<UpdateStickerPackInput>,
  ): ResolvedPackState {
    const legacyPublished =
      input.isPublished ?? input.published ?? (input.isActive === true ? true : undefined);
    const legacyHidden =
      input.isHidden ??
      (input.isActive === false && input.archived === undefined && input.isArchived === undefined
        ? true
        : undefined);
    const legacyArchived = input.isArchived ?? input.archived;
    const currentPublished =
      current?.isPublished ?? Boolean(current?.publishedAt ?? current?.isActive);
    const currentArchived = current?.isArchived ?? Boolean(current?.archivedAt);
    const currentHidden = current?.isHidden ?? false;
    const isPublished = legacyPublished ?? currentPublished ?? false;
    const isHidden = legacyHidden ?? currentHidden;
    const isArchived = legacyArchived ?? currentArchived;
    const isDiscoverable = input.isDiscoverable ?? current?.isDiscoverable ?? false;

    return {
      isPublished,
      isDiscoverable,
      isHidden,
      isArchived,
      isActive: input.isActive ?? (isPublished && !isHidden && !isArchived),
    };
  }

  private resolveStickerState(
    current:
      | Pick<
          Sticker,
          'isActive' | 'isPublished' | 'isHidden' | 'isArchived' | 'publishedAt' | 'archivedAt'
        >
      | null,
    input: Partial<UpdateStickerInput>,
  ): ResolvedStickerState {
    const legacyPublished =
      input.isPublished ?? input.published ?? (input.isActive === true ? true : undefined);
    const legacyHidden =
      input.isHidden ??
      (input.isActive === false && input.archived === undefined && input.isArchived === undefined
        ? true
        : undefined);
    const legacyArchived = input.isArchived ?? input.archived;
    const currentPublished =
      current?.isPublished ?? Boolean(current?.publishedAt ?? current?.isActive);
    const currentArchived = current?.isArchived ?? Boolean(current?.archivedAt);
    const currentHidden = current?.isHidden ?? false;
    const isPublished = legacyPublished ?? currentPublished ?? false;
    const isHidden = legacyHidden ?? currentHidden;
    const isArchived = legacyArchived ?? currentArchived;

    return {
      isPublished,
      isHidden,
      isArchived,
      isActive: input.isActive ?? (isPublished && !isHidden && !isArchived),
    };
  }

  private buildPackLifecycleCreateData(state: ResolvedPackState) {
    const now = new Date();

    return {
      isActive: state.isActive,
      isPublished: state.isPublished,
      isDiscoverable: state.isDiscoverable,
      isHidden: state.isHidden,
      isArchived: state.isArchived,
      publishedAt: state.isPublished ? now : null,
      archivedAt: state.isArchived ? now : null,
    };
  }

  private buildPackLifecycleUpdate(
    current: Pick<PrismaStickerPack, 'publishedAt' | 'archivedAt'>,
    state: ResolvedPackState,
  ): Prisma.StickerPackUpdateInput {
    const now = new Date();

    return {
      isActive: state.isActive,
      isPublished: state.isPublished,
      isDiscoverable: state.isDiscoverable,
      isHidden: state.isHidden,
      isArchived: state.isArchived,
      publishedAt: state.isPublished ? current.publishedAt ?? now : null,
      archivedAt: state.isArchived ? current.archivedAt ?? now : null,
    };
  }

  private buildStickerLifecycleCreateData(state: ResolvedStickerState) {
    const now = new Date();

    return {
      isActive: state.isActive,
      isPublished: state.isPublished,
      isHidden: state.isHidden,
      isArchived: state.isArchived,
      publishedAt: state.isPublished ? now : null,
      archivedAt: state.isArchived ? now : null,
    };
  }

  private buildStickerLifecycleUpdate(
    current: Pick<Sticker, 'publishedAt' | 'archivedAt'>,
    state: ResolvedStickerState,
  ): Prisma.StickerUpdateInput {
    const now = new Date();

    return {
      isActive: state.isActive,
      isPublished: state.isPublished,
      isHidden: state.isHidden,
      isArchived: state.isArchived,
      publishedAt: state.isPublished ? current.publishedAt ?? now : null,
      archivedAt: state.isArchived ? current.archivedAt ?? now : null,
    };
  }

  private normalizeKeywords(value: unknown) {
    return [...new Set(
      (Array.isArray(value) ? value : [])
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean),
    )].slice(0, 24);
  }

  private buildStickerSearchText(
    title: string,
    keywords: string[],
    originalName: string | null,
  ) {
    return [title, ...keywords, originalName ?? '']
      .join(' ')
      .trim()
      .toLowerCase();
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

    return `Sticker ${sortOrder + 1}`;
  }

  private getCatalogPackWhere(): Prisma.StickerPackWhereInput {
    return {
      deletedAt: null,
      isActive: true,
      isPublished: true,
      isHidden: false,
      isArchived: false,
    };
  }

  private getCatalogStickerWhere(): Prisma.StickerWhereInput {
    return {
      deletedAt: null,
      isActive: true,
      isPublished: true,
      isHidden: false,
      isArchived: false,
    };
  }

  private getDiscoverablePackWhere(): Prisma.StickerPackWhereInput {
    return {
      ...this.getCatalogPackWhere(),
      isDiscoverable: true,
    };
  }

  private getDiscoverableStickerWhere(): Prisma.StickerWhereInput {
    return this.getCatalogStickerWhere();
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

  private async createPackWithGeneratedSlug(
    args: {
      actorUserId: string;
      title: string;
      description: string | null;
      sortOrder: number;
      state: ResolvedPackState;
    },
    client: PrismaLike = this.prisma,
  ): Promise<StickerPackWithStickers> {
    const baseSlug = buildStickerPackSlug(args.title);

    for (let sequence = 1; sequence <= 100; sequence += 1) {
      try {
        const pack = await client.stickerPack.create({
          data: {
            ownerId: args.actorUserId,
            title: args.title,
            slug: buildStickerPackSlugVariant(baseSlug, sequence),
            description: args.description,
            sortOrder: args.sortOrder,
            ...this.buildPackLifecycleCreateData(args.state),
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

        return pack as StickerPackWithStickers;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          continue;
        }

        throw error;
      }
    }

    throw new ConflictException('Could not generate a unique sticker pack slug.');
  }
}


