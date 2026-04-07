import {
  adminMediaLibrarySchema,
  customEmojiAssetSchema,
  gifAssetSchema,
  mediaPickerCatalogSchema,
  type AdminMediaLibrary,
  type CustomEmojiAsset,
  type GifAsset,
  type MediaPickerCatalog,
  type StickerCatalog,
  type StickerPack,
} from '@lobby/shared';
import type { CustomEmoji, GifAsset as PrismaGifAsset } from '@prisma/client';

export function toCustomEmojiAsset(emoji: CustomEmoji): CustomEmojiAsset {
  return customEmojiAssetSchema.parse({
    id: emoji.id,
    alias: emoji.alias,
    title: emoji.title,
    fileKey: emoji.fileKey,
    originalName: emoji.originalName,
    mimeType: emoji.mimeType,
    fileSize: emoji.fileSize,
    width: emoji.width,
    height: emoji.height,
    isActive: emoji.isActive,
    sortOrder: emoji.sortOrder,
    createdById: emoji.createdById,
    createdAt: emoji.createdAt.toISOString(),
    updatedAt: emoji.updatedAt.toISOString(),
  });
}

export function toGifAsset(gif: PrismaGifAsset): GifAsset {
  const rawTags = Array.isArray(gif.tags) ? gif.tags : [];

  return gifAssetSchema.parse({
    id: gif.id,
    title: gif.title,
    tags: rawTags.filter((tag): tag is string => typeof tag === 'string'),
    fileKey: gif.fileKey,
    previewKey: gif.previewKey,
    originalName: gif.originalName,
    mimeType: gif.mimeType,
    fileSize: gif.fileSize,
    width: gif.width,
    height: gif.height,
    durationMs: gif.durationMs,
    isActive: gif.isActive,
    sortOrder: gif.sortOrder,
    createdById: gif.createdById,
    createdAt: gif.createdAt.toISOString(),
    updatedAt: gif.updatedAt.toISOString(),
  });
}

export function toMediaPickerCatalog(args: {
  customEmojis: CustomEmoji[];
  gifs: PrismaGifAsset[];
  stickers: StickerCatalog;
}): MediaPickerCatalog {
  return mediaPickerCatalogSchema.parse({
    customEmojis: args.customEmojis.map((emoji) => toCustomEmojiAsset(emoji)),
    gifs: args.gifs.map((gif) => toGifAsset(gif)),
    stickers: args.stickers,
  });
}

export function toAdminMediaLibrary(args: {
  emojis: CustomEmoji[];
  gifs: PrismaGifAsset[];
  stickerPacks: StickerPack[];
}): AdminMediaLibrary {
  return adminMediaLibrarySchema.parse({
    emojis: args.emojis.map((emoji) => toCustomEmojiAsset(emoji)),
    gifs: args.gifs.map((gif) => toGifAsset(gif)),
    stickerPacks: args.stickerPacks,
  });
}
