import { z } from "zod";
import { actionMessageSchema, isoDateSchema } from "./common";

export const stickerTypeSchema = z.enum(["STATIC", "ANIMATED"]);
export type StickerType = z.infer<typeof stickerTypeSchema>;

export const stickerAssetSchema = z.object({
  id: z.string().cuid(),
  packId: z.string().cuid(),
  title: z.string().trim().min(1).max(80),
  type: stickerTypeSchema,
  fileKey: z.string(),
  animatedFileKey: z.string().nullable().optional(),
  animatedMimeType: z.string().nullable().optional(),
  originalName: z.string().nullable(),
  mimeType: z.string(),
  fileSize: z.number().int().positive(),
  sourceFileKey: z.string().nullable().optional(),
  sourceMimeType: z.string().nullable().optional(),
  sourceFileSize: z.number().int().positive().nullable().optional(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  isAnimated: z.boolean(),
  durationMs: z.number().int().positive().nullable().optional(),
  keywords: z.array(z.string().trim().min(1).max(32)).max(24).default([]),
  isActive: z.boolean(),
  publishedAt: isoDateSchema.nullable().optional(),
  archivedAt: isoDateSchema.nullable().optional(),
  deletedAt: isoDateSchema.nullable().optional(),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
});

export type StickerAsset = z.infer<typeof stickerAssetSchema>;

export const stickerPackSchema = z.object({
  id: z.string().cuid(),
  ownerId: z.string().cuid(),
  createdById: z.string().cuid(),
  title: z.string().trim().min(1).max(80),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9-]+$/i, "Допустимы только буквы, цифры и дефис."),
  description: z.string().trim().max(300).nullable().optional(),
  coverStickerId: z.string().cuid().nullable().optional(),
  sortOrder: z.number().int().nonnegative(),
  isActive: z.boolean(),
  publishedAt: isoDateSchema.nullable().optional(),
  archivedAt: isoDateSchema.nullable().optional(),
  deletedAt: isoDateSchema.nullable().optional(),
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
  slug: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9-]+$/i, "Допустимы только буквы, цифры и дефис.")
    .optional(),
  description: z.string().trim().max(300).nullable().optional(),
  published: z.boolean().optional(),
});

export type CreateStickerPackInput = z.infer<typeof createStickerPackSchema>;

export const renameStickerPackSchema = z.object({
  title: z.string().trim().min(1).max(80),
});

export type RenameStickerPackInput = z.infer<typeof renameStickerPackSchema>;

export const updateStickerPackSchema = z
  .object({
    title: z.string().trim().min(1).max(80).optional(),
    slug: z
      .string()
      .trim()
      .min(2)
      .max(120)
      .regex(/^[a-z0-9-]+$/i, "Допустимы только буквы, цифры и дефис.")
      .optional(),
    description: z.string().trim().max(300).nullable().optional(),
    coverStickerId: z.string().cuid().nullable().optional(),
    isActive: z.boolean().optional(),
    published: z.boolean().optional(),
    archived: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.slug !== undefined ||
      value.description !== undefined ||
      value.coverStickerId !== undefined ||
      value.isActive !== undefined ||
      value.published !== undefined ||
      value.archived !== undefined,
    {
      message: "Нужно передать хотя бы одно изменение.",
    },
  );

export type UpdateStickerPackInput = z.infer<typeof updateStickerPackSchema>;

export const reorderStickerPacksSchema = z.object({
  packIds: z.array(z.string().cuid()).min(1).max(200),
});

export type ReorderStickerPacksInput = z.infer<typeof reorderStickerPacksSchema>;

export const reorderStickersSchema = z.object({
  stickerIds: z.array(z.string().cuid()).min(1).max(500),
});

export type ReorderStickersInput = z.infer<typeof reorderStickersSchema>;

export const updateStickerSchema = z
  .object({
    title: z.string().trim().min(1).max(80).optional(),
    isActive: z.boolean().optional(),
    keywords: z.array(z.string().trim().min(1).max(32)).max(24).optional(),
    published: z.boolean().optional(),
    archived: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.isActive !== undefined ||
      value.keywords !== undefined ||
      value.published !== undefined ||
      value.archived !== undefined,
    {
      message: "Нужно передать хотя бы одно изменение.",
    },
  );

export type UpdateStickerInput = z.infer<typeof updateStickerSchema>;

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
