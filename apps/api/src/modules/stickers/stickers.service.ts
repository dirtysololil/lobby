import {
  BadRequestException,
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
import type { Prisma, Sticker } from '@prisma/client';
import type { RequestMetadata } from '../../common/interfaces/request-metadata.interface';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EnvService } from '../env/env.service';
import { StorageService } from '../storage/storage.service';
import { parseStickerImageMetadata } from '../storage/sticker-image.util';
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
          isActive: true,
          stickers: {
            some: {
              deletedAt: null,
              isActive: true,
            },
          },
        },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        include: {
          stickers: {
            where: {
              deletedAt: null,
              isActive: true,
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
              isActive: true,
            },
          },
          pack: {
            is: {
              deletedAt: null,
              isActive: true,
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
    const pack = await this.prisma.stickerPack.create({
      data: {
        ownerId: actorUserId,
        title: input.title.trim(),
        sortOrder,
        isActive: true,
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
      action: 'stickers.pack.create',
      entityType: 'StickerPack',
      entityId: pack.id,
      actorUserId,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      metadata: {
        title: pack.title,
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
    await this.getPackOrThrow(packId);

    const pack = await this.prisma.stickerPack.update({
      where: {
        id: packId,
      },
      data: {
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
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
        isActive: input.isActive ?? null,
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
    requestMetadata: RequestMetadata,
  ): Promise<StickerAsset> {
    await this.getPackOrThrow(packId);

    if (!file || !file.buffer || file.size === 0) {
      throw new BadRequestException('Выберите файл стикера.');
    }

    const env = this.envService.getValues();
    const maxBytes = Math.floor(env.MAX_STICKER_MB * 1024 * 1024);

    if (file.size > maxBytes) {
      throw new BadRequestException(
        `Стикер слишком большой. Максимальный размер: ${env.MAX_STICKER_MB} MB.`,
      );
    }

    let metadata;

    try {
      metadata = parseStickerImageMetadata(file.buffer, {
        maxFrames: env.MAX_STICKER_FRAMES,
        maxAnimationMs: env.MAX_STICKER_ANIMATION_MS,
        maxDimension: env.MAX_STICKER_DIMENSION,
      });
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : 'Не удалось обработать файл стикера.',
      );
    }

    const fileKey = await this.storageService.writeSticker(
      file.buffer,
      metadata.extension,
    );
    const sortOrder = await this.getNextStickerSortOrder(packId);
    const title = this.resolveStickerTitle(rawTitle, file.originalname, sortOrder);

    try {
      const sticker = await this.prisma.sticker.create({
        data: {
          packId,
          title,
          fileKey,
          originalName: file.originalname || null,
          mimeType: metadata.mimeType,
          fileSize: metadata.bytes,
          width: metadata.width,
          height: metadata.height,
          isAnimated: metadata.isAnimated,
          sortOrder,
          isActive: true,
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
          mimeType: metadata.mimeType,
          bytes: metadata.bytes,
          isAnimated: metadata.isAnimated,
        },
      });

      return toStickerAsset(sticker);
    } catch (error) {
      await this.storageService.deleteObject(fileKey);
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
    await this.getStickerOrThrow(packId, stickerId);

    const sticker = await this.prisma.sticker.update({
      where: {
        id: stickerId,
      },
      data: {
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
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
        isActive: input.isActive ?? null,
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
        isActive: true,
        pack: {
          is: {
            deletedAt: null,
            isActive: true,
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
      },
    });

    if (!sticker) {
      throw new NotFoundException('Стикер не найден.');
    }

    try {
      return {
        buffer: await this.storageService.readObject(sticker.fileKey),
        mimeType: sticker.mimeType,
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
}
