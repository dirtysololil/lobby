import {
  stickerAssetSchema,
  stickerCatalogSchema,
  stickerPackDiscoverySchema,
  stickerPackSchema,
  stickerRecentSchema,
  type StickerAsset,
  type StickerCatalog,
  type StickerPack,
  type StickerPackDiscovery,
  type StickerRecent,
} from '@lobby/shared';
import type {
  Sticker as PrismaSticker,
  StickerPack as PrismaStickerPack,
  StickerRecent as PrismaStickerRecent,
} from '@prisma/client';
import { buildStickerPackSlugFallbackFromId } from './sticker-pack-slug.util';

export type StickerPackWithStickers = PrismaStickerPack & {
  stickers: PrismaSticker[];
};

export type StickerPackDiscoveryRecord = PrismaStickerPack & {
  coverSticker: PrismaSticker | null;
  stickers: PrismaSticker[];
};

export type StickerRecentRecord = PrismaStickerRecent & {
  pack: PrismaStickerPack;
  sticker: PrismaSticker;
};

function normalizeKeywords(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

export function toStickerAsset(sticker: PrismaSticker): StickerAsset {
  return stickerAssetSchema.parse({
    id: sticker.id,
    packId: sticker.packId,
    title: sticker.title,
    type: sticker.type ?? (sticker.isAnimated ? 'ANIMATED' : 'STATIC'),
    fileKey: sticker.fileKey,
    animatedFileKey: sticker.animatedFileKey ?? null,
    animatedMimeType: sticker.animatedMimeType ?? null,
    originalName: sticker.originalName,
    mimeType: sticker.mimeType,
    fileSize: sticker.fileSize,
    sourceFileKey: sticker.sourceFileKey ?? sticker.fileKey,
    sourceMimeType: sticker.sourceMimeType ?? sticker.mimeType,
    sourceFileSize: sticker.sourceFileSize ?? sticker.fileSize,
    width: sticker.width,
    height: sticker.height,
    isAnimated: sticker.isAnimated,
    durationMs: sticker.durationMs ?? null,
    keywords: normalizeKeywords(sticker.keywords),
    searchText: sticker.searchText ?? null,
    sortOrder: sticker.sortOrder,
    isActive: sticker.isActive,
    isPublished: sticker.isPublished,
    isHidden: sticker.isHidden,
    isArchived: sticker.isArchived,
    publishedAt: sticker.publishedAt?.toISOString() ?? null,
    archivedAt: sticker.archivedAt?.toISOString() ?? null,
    deletedAt: sticker.deletedAt?.toISOString() ?? null,
    createdAt: sticker.createdAt.toISOString(),
    updatedAt: sticker.updatedAt.toISOString(),
  });
}

export function toStickerPack(pack: StickerPackWithStickers): StickerPack {
  return stickerPackSchema.parse({
    id: pack.id,
    ownerId: pack.ownerId,
    createdById: pack.ownerId,
    title: pack.title,
    slug: pack.slug ?? buildStickerPackSlugFallbackFromId(pack.id),
    description: pack.description ?? null,
    coverStickerId: pack.coverStickerId ?? null,
    stickerCount: pack.stickers.length,
    sortOrder: pack.sortOrder,
    isActive: pack.isActive,
    isPublished: pack.isPublished,
    isDiscoverable: pack.isDiscoverable,
    isHidden: pack.isHidden,
    isArchived: pack.isArchived,
    publishedAt: pack.publishedAt?.toISOString() ?? null,
    archivedAt: pack.archivedAt?.toISOString() ?? null,
    deletedAt: pack.deletedAt?.toISOString() ?? null,
    createdAt: pack.createdAt.toISOString(),
    updatedAt: pack.updatedAt.toISOString(),
    stickers: pack.stickers.map((sticker) => toStickerAsset(sticker)),
  });
}

export function toStickerPackDiscovery(
  pack: StickerPackDiscoveryRecord,
  isInstalled: boolean,
): StickerPackDiscovery {
  const coverSticker =
    pack.coverSticker && !pack.coverSticker.deletedAt
      ? pack.coverSticker
      : (pack.stickers[0] ?? null);

  return stickerPackDiscoverySchema.parse({
    id: pack.id,
    title: pack.title,
    description: pack.description ?? null,
    coverStickerId: pack.coverStickerId ?? null,
    stickerCount: pack.stickers.length,
    isInstalled,
    coverSticker: coverSticker ? toStickerAsset(coverSticker) : null,
  });
}

export function toStickerRecent(recent: StickerRecentRecord): StickerRecent {
  return stickerRecentSchema.parse({
    packId: recent.packId,
    packTitle: recent.pack.title,
    usedAt: recent.usedAt.toISOString(),
    usageCount: recent.usageCount,
    sticker: toStickerAsset(recent.sticker),
  });
}

export function toStickerCatalog(args: {
  packs: StickerPackWithStickers[];
  recent: StickerRecentRecord[];
}): StickerCatalog {
  return stickerCatalogSchema.parse({
    packs: args.packs.map((pack) => toStickerPack(pack)),
    recent: args.recent.map((item) => toStickerRecent(item)),
  });
}
