import { z } from "zod";
import { actionMessageSchema, isoDateSchema } from "./common";
import { stickerPackSchema, stickerCatalogSchema } from "./stickers";

const assetTitleSchema = z.string().trim().min(1).max(80);
const assetAliasSchema = z
  .string()
  .trim()
  .min(2)
  .max(32)
  .regex(/^[a-z0-9_+-]+$/i, "Допустимы только буквы, цифры, _, + и -.");
const assetTagSchema = z
  .string()
  .trim()
  .min(1)
  .max(24)
  .regex(/^[\p{L}\p{N}_+\- ]+$/u, "Тег содержит недопустимые символы.");

export const customEmojiAssetSchema = z.object({
  id: z.string().cuid(),
  alias: assetAliasSchema,
  title: assetTitleSchema,
  fileKey: z.string(),
  originalName: z.string().nullable(),
  mimeType: z.string(),
  fileSize: z.number().int().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  isActive: z.boolean(),
  sortOrder: z.number().int().nonnegative(),
  createdById: z.string().cuid(),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
});

export type CustomEmojiAsset = z.infer<typeof customEmojiAssetSchema>;

export const gifAssetSchema = z.object({
  id: z.string().cuid(),
  title: assetTitleSchema,
  tags: z.array(assetTagSchema).max(12),
  fileKey: z.string(),
  previewKey: z.string().nullable(),
  originalName: z.string().nullable(),
  mimeType: z.string(),
  fileSize: z.number().int().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  durationMs: z.number().int().positive().nullable(),
  isActive: z.boolean(),
  sortOrder: z.number().int().nonnegative(),
  createdById: z.string().cuid(),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
});

export type GifAsset = z.infer<typeof gifAssetSchema>;

export const mediaPickerCatalogSchema = z.object({
  customEmojis: z.array(customEmojiAssetSchema),
  gifs: z.array(gifAssetSchema),
  stickers: stickerCatalogSchema,
});

export type MediaPickerCatalog = z.infer<typeof mediaPickerCatalogSchema>;

export const mediaPickerCatalogResponseSchema = z.object({
  catalog: mediaPickerCatalogSchema,
});

export type MediaPickerCatalogResponse = z.infer<
  typeof mediaPickerCatalogResponseSchema
>;

export const adminMediaLibrarySchema = z.object({
  emojis: z.array(customEmojiAssetSchema),
  gifs: z.array(gifAssetSchema),
  stickerPacks: z.array(stickerPackSchema),
});

export type AdminMediaLibrary = z.infer<typeof adminMediaLibrarySchema>;

export const adminMediaLibraryResponseSchema = z.object({
  library: adminMediaLibrarySchema,
});

export type AdminMediaLibraryResponse = z.infer<
  typeof adminMediaLibraryResponseSchema
>;

export const createCustomEmojiSchema = z.object({
  alias: assetAliasSchema,
  title: assetTitleSchema.optional(),
});

export type CreateCustomEmojiInput = z.infer<typeof createCustomEmojiSchema>;

export const updateCustomEmojiSchema = z
  .object({
    alias: assetAliasSchema.optional(),
    title: assetTitleSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.alias !== undefined ||
      value.title !== undefined ||
      value.isActive !== undefined,
    {
      message: "Нужно передать хотя бы одно изменение.",
    },
  );

export type UpdateCustomEmojiInput = z.infer<typeof updateCustomEmojiSchema>;

export const reorderCustomEmojisSchema = z.object({
  emojiIds: z.array(z.string().cuid()).min(1).max(500),
});

export type ReorderCustomEmojisInput = z.infer<
  typeof reorderCustomEmojisSchema
>;

export const createGifAssetSchema = z.object({
  title: assetTitleSchema,
  tags: z.array(assetTagSchema).max(12).default([]),
});

export type CreateGifAssetInput = z.infer<typeof createGifAssetSchema>;

export const updateGifAssetSchema = z
  .object({
    title: assetTitleSchema.optional(),
    tags: z.array(assetTagSchema).max(12).optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.tags !== undefined ||
      value.isActive !== undefined,
    {
      message: "Нужно передать хотя бы одно изменение.",
    },
  );

export type UpdateGifAssetInput = z.infer<typeof updateGifAssetSchema>;

export const reorderGifAssetsSchema = z.object({
  gifIds: z.array(z.string().cuid()).min(1).max(500),
});

export type ReorderGifAssetsInput = z.infer<typeof reorderGifAssetsSchema>;

export const customEmojiResponseSchema = z.object({
  emoji: customEmojiAssetSchema,
});

export type CustomEmojiResponse = z.infer<typeof customEmojiResponseSchema>;

export const gifAssetResponseSchema = z.object({
  gif: gifAssetSchema,
});

export type GifAssetResponse = z.infer<typeof gifAssetResponseSchema>;

export const mediaActionResponseSchema = actionMessageSchema;

export type MediaActionResponse = z.infer<typeof mediaActionResponseSchema>;
