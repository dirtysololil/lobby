import { z } from "zod";

export const emojiToneSchema = z.enum([
  "default",
  "light",
  "medium-light",
  "medium",
  "medium-dark",
  "dark",
]);

export type EmojiTone = z.infer<typeof emojiToneSchema>;

export const emojiCategoryIdSchema = z.enum([
  "recent",
  "smileys",
  "people",
  "nature",
  "food",
  "travel",
  "activity",
  "symbols",
  "flags",
]);

export type EmojiCategoryId = z.infer<typeof emojiCategoryIdSchema>;

export const emojiManifestEntrySchema = z.object({
  emoji: z.string().min(1),
  label: z.string().trim().min(1).max(120),
  keywords: z.array(z.string().trim().min(1).max(32)).max(24),
  category: emojiCategoryIdSchema.exclude(["recent"]),
  toneVariants: z.record(emojiToneSchema, z.string().min(1)).optional(),
});

export type EmojiManifestEntry = z.infer<typeof emojiManifestEntrySchema>;

export const emojiManifestSchema = z.object({
  version: z.string().trim().min(1).max(40),
  provider: z.enum(["TWEMOJI"]),
  entries: z.array(emojiManifestEntrySchema),
});

export type EmojiManifest = z.infer<typeof emojiManifestSchema>;

export const emojiManifestResponseSchema = z.object({
  manifest: emojiManifestSchema,
});

export type EmojiManifestResponse = z.infer<typeof emojiManifestResponseSchema>;

export const defaultEmojiManifestVersion = "twemoji-15.1.0";
