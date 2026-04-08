import {
  stickerAssetSchema,
  stickerCatalogSchema,
  stickerPackSchema,
  stickerRecentSchema,
  type StickerAsset,
  type StickerCatalog,
  type StickerPack,
  type StickerRecent,
} from '@lobby/shared';
import type {
  Sticker as PrismaSticker,
  StickerPack as PrismaStickerPack,
  StickerRecent as PrismaStickerRecent,
} from '@prisma/client';

export type StickerPackWithStickers = PrismaStickerPack & {
  stickers: PrismaSticker[];
};

export type StickerRecentRecord = PrismaStickerRecent & {
  pack: PrismaStickerPack;
  sticker: PrismaSticker;
};

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
    keywords: Array.isArray(sticker.keywords)
      ? sticker.keywords.filter((item): item is string => typeof item === 'string')
      : [],
    isActive: sticker.isActive,
    publishedAt:
      ('publishedAt' in sticker ? sticker.publishedAt : null)?.toISOString() ??
      (sticker.isActive ? sticker.updatedAt.toISOString() : null),
    archivedAt:
      ('archivedAt' in sticker ? sticker.archivedAt : null)?.toISOString() ?? null,
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
    slug: pack.slug ?? createFallbackSlug(pack.title, pack.id),
    description: pack.description ?? null,
    coverStickerId: pack.coverStickerId ?? null,
    sortOrder: pack.sortOrder,
    isActive: pack.isActive,
    publishedAt:
      pack.publishedAt?.toISOString() ??
      (pack.isActive ? pack.updatedAt.toISOString() : null),
    archivedAt: pack.archivedAt?.toISOString() ?? null,
    deletedAt: pack.deletedAt?.toISOString() ?? null,
    createdAt: pack.createdAt.toISOString(),
    updatedAt: pack.updatedAt.toISOString(),
    stickers: pack.stickers.map((sticker) => toStickerAsset(sticker)),
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

function createFallbackSlug(title: string, id: string): string {
  const normalized = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  return normalized ? `${normalized}-${id.slice(-6)}` : `pack-${id.slice(-8)}`;
}
