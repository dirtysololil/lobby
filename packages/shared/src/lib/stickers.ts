import { z } from "zod";
import { actionMessageSchema, isoDateSchema } from "./common";

const stickerTitleSchema = z.string().trim().min(1).max(80);
const stickerDescriptionSchema = z.string().trim().max(300);
const stickerKeywordSchema = z.string().trim().min(1).max(32);
const stickerSlugSchema = z
  .string()
  .trim()
  .min(2)
  .max(120)
  .regex(/^[a-z0-9-]+$/i, "Slug may only contain letters, numbers, and hyphens.");

export const stickerTypeSchema = z.enum(["STATIC", "ANIMATED"]);
export type StickerType = z.infer<typeof stickerTypeSchema>;

export const stickerAssetSchema = z.object({
  id: z.string().cuid(),
  packId: z.string().cuid(),
  title: stickerTitleSchema,
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
  keywords: z.array(stickerKeywordSchema).max(24).default([]),
  searchText: z.string().nullable().optional(),
  sortOrder: z.number().int().nonnegative(),
  isActive: z.boolean(),
  isPublished: z.boolean(),
  isHidden: z.boolean(),
  isArchived: z.boolean(),
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
  title: stickerTitleSchema,
  slug: stickerSlugSchema,
  description: stickerDescriptionSchema.nullable().optional(),
  coverStickerId: z.string().cuid().nullable().optional(),
  stickerCount: z.number().int().nonnegative(),
  sortOrder: z.number().int().nonnegative(),
  isActive: z.boolean(),
  isPublished: z.boolean(),
  isDiscoverable: z.boolean(),
  isHidden: z.boolean(),
  isArchived: z.boolean(),
  publishedAt: isoDateSchema.nullable().optional(),
  archivedAt: isoDateSchema.nullable().optional(),
  deletedAt: isoDateSchema.nullable().optional(),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
  stickers: z.array(stickerAssetSchema),
});

export type StickerPack = z.infer<typeof stickerPackSchema>;

export const stickerPackDiscoverySchema = z.object({
  id: z.string().cuid(),
  title: stickerTitleSchema,
  description: stickerDescriptionSchema.nullable(),
  coverStickerId: z.string().cuid().nullable(),
  stickerCount: z.number().int().nonnegative(),
  isInstalled: z.boolean(),
  coverSticker: stickerAssetSchema.nullable(),
});

export type StickerPackDiscovery = z.infer<typeof stickerPackDiscoverySchema>;

export const stickerRecentSchema = z.object({
  packId: z.string().cuid(),
  packTitle: stickerTitleSchema,
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
  title: stickerTitleSchema,
  description: stickerDescriptionSchema.nullable().optional(),
  published: z.boolean().optional(),
  isPublished: z.boolean().optional(),
  isDiscoverable: z.boolean().optional(),
});

export type CreateStickerPackInput = z.infer<typeof createStickerPackSchema>;

export const renameStickerPackSchema = z.object({
  title: stickerTitleSchema,
});

export type RenameStickerPackInput = z.infer<typeof renameStickerPackSchema>;

export const updateStickerPackSchema = z
  .object({
    title: stickerTitleSchema.optional(),
    description: stickerDescriptionSchema.nullable().optional(),
    coverStickerId: z.string().cuid().nullable().optional(),
    isActive: z.boolean().optional(),
    published: z.boolean().optional(),
    archived: z.boolean().optional(),
    isPublished: z.boolean().optional(),
    isDiscoverable: z.boolean().optional(),
    isHidden: z.boolean().optional(),
    isArchived: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.description !== undefined ||
      value.coverStickerId !== undefined ||
      value.isActive !== undefined ||
      value.published !== undefined ||
      value.archived !== undefined ||
      value.isPublished !== undefined ||
      value.isDiscoverable !== undefined ||
      value.isHidden !== undefined ||
      value.isArchived !== undefined,
    {
      message: "At least one sticker pack field must be updated.",
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

export const setStickerPackCoverSchema = z.object({
  stickerId: z.string().cuid().nullable(),
});

export type SetStickerPackCoverInput = z.infer<typeof setStickerPackCoverSchema>;

export const updateStickerSchema = z
  .object({
    title: stickerTitleSchema.optional(),
    keywords: z.array(stickerKeywordSchema).max(24).optional(),
    isActive: z.boolean().optional(),
    published: z.boolean().optional(),
    archived: z.boolean().optional(),
    isPublished: z.boolean().optional(),
    isHidden: z.boolean().optional(),
    isArchived: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.keywords !== undefined ||
      value.isActive !== undefined ||
      value.published !== undefined ||
      value.archived !== undefined ||
      value.isPublished !== undefined ||
      value.isHidden !== undefined ||
      value.isArchived !== undefined,
    {
      message: "At least one sticker field must be updated.",
    },
  );

export type UpdateStickerInput = z.infer<typeof updateStickerSchema>;

export const discoverStickerPacksQuerySchema = z.object({
  query: z.string().trim().max(80).default(""),
});

export type DiscoverStickerPacksQuery = z.infer<typeof discoverStickerPacksQuerySchema>;

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

export const adminStickerPacksResponseSchema = z.object({
  packs: z.array(stickerPackSchema),
});

export type AdminStickerPacksResponse = z.infer<typeof adminStickerPacksResponseSchema>;

export const discoverStickerPacksResponseSchema = z.object({
  packs: z.array(stickerPackDiscoverySchema),
});

export type DiscoverStickerPacksResponse = z.infer<
  typeof discoverStickerPacksResponseSchema
>;

export const stickerActionResponseSchema = actionMessageSchema;

export type StickerActionResponse = z.infer<typeof stickerActionResponseSchema>;
