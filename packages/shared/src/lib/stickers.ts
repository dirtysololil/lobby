import { z } from "zod";
import { actionMessageSchema, isoDateSchema } from "./common";

export const stickerAssetSchema = z.object({
  id: z.string().cuid(),
  packId: z.string().cuid(),
  title: z.string().trim().min(1).max(80),
  fileKey: z.string(),
  originalName: z.string().nullable(),
  mimeType: z.string(),
  fileSize: z.number().int().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  isAnimated: z.boolean(),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
});

export type StickerAsset = z.infer<typeof stickerAssetSchema>;

export const stickerPackSchema = z.object({
  id: z.string().cuid(),
  ownerId: z.string().cuid(),
  title: z.string().trim().min(1).max(80),
  sortOrder: z.number().int().nonnegative(),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
  stickers: z.array(stickerAssetSchema),
});

export type StickerPack = z.infer<typeof stickerPackSchema>;

export const stickerRecentSchema = z.object({
  packId: z.string().cuid(),
  packTitle: z.string().trim().min(1).max(80),
  usedAt: isoDateSchema,
  usageCount: z.number().int().positive(),
  sticker: stickerAssetSchema,
});

export type StickerRecent = z.infer<typeof stickerRecentSchema>;

export const stickerCatalogSchema = z.object({
  packs: z.array(stickerPackSchema),
  recent: z.array(stickerRecentSchema),
});

export type StickerCatalog = z.infer<typeof stickerCatalogSchema>;

export const createStickerPackSchema = z.object({
  title: z.string().trim().min(1).max(80),
});

export type CreateStickerPackInput = z.infer<typeof createStickerPackSchema>;

export const renameStickerPackSchema = z.object({
  title: z.string().trim().min(1).max(80),
});

export type RenameStickerPackInput = z.infer<typeof renameStickerPackSchema>;

export const reorderStickerPacksSchema = z.object({
  packIds: z.array(z.string().cuid()).min(1).max(200),
});

export type ReorderStickerPacksInput = z.infer<typeof reorderStickerPacksSchema>;

export const reorderStickersSchema = z.object({
  stickerIds: z.array(z.string().cuid()).min(1).max(500),
});

export type ReorderStickersInput = z.infer<typeof reorderStickersSchema>;

export const createStickerResponseSchema = z.object({
  sticker: stickerAssetSchema,
});

export type CreateStickerResponse = z.infer<typeof createStickerResponseSchema>;

export const stickerResponseSchema = z.object({
  sticker: stickerAssetSchema,
});

export type StickerResponse = z.infer<typeof stickerResponseSchema>;

export const stickerPackResponseSchema = z.object({
  pack: stickerPackSchema,
});

export type StickerPackResponse = z.infer<typeof stickerPackResponseSchema>;

export const stickerCatalogResponseSchema = z.object({
  catalog: stickerCatalogSchema,
});

export type StickerCatalogResponse = z.infer<typeof stickerCatalogResponseSchema>;

export const stickerActionResponseSchema = actionMessageSchema;

export type StickerActionResponse = z.infer<typeof stickerActionResponseSchema>;
