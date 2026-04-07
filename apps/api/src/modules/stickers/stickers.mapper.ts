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
    fileKey: sticker.fileKey,
    originalName: sticker.originalName,
    mimeType: sticker.mimeType,
    fileSize: sticker.fileSize,
    width: sticker.width,
    height: sticker.height,
    isAnimated: sticker.isAnimated,
    isActive: sticker.isActive,
    createdAt: sticker.createdAt.toISOString(),
    updatedAt: sticker.updatedAt.toISOString(),
  });
}

export function toStickerPack(pack: StickerPackWithStickers): StickerPack {
  return stickerPackSchema.parse({
    id: pack.id,
    ownerId: pack.ownerId,
    title: pack.title,
    sortOrder: pack.sortOrder,
    isActive: pack.isActive,
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
