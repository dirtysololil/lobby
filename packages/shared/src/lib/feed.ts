import { z } from "zod";
import { isoDateSchema, publicUserSchema } from "./common";

export const feedPostKindSchema = z.enum(["ARTICLE", "VIDEO"]);
export type FeedPostKind = z.infer<typeof feedPostKindSchema>;

export const feedPostSchema = z.object({
  id: z.string().cuid(),
  kind: feedPostKindSchema,
  title: z.string().nullable(),
  body: z.string(),
  mediaUrl: z.string().url().nullable(),
  author: publicUserSchema,
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
});

export type FeedPost = z.infer<typeof feedPostSchema>;

export const createFeedPostSchema = z
  .object({
    kind: feedPostKindSchema.default("ARTICLE"),
    title: z.string().trim().max(160).nullable().optional(),
    body: z.string().trim().min(1).max(10_000),
    mediaUrl: z.string().trim().url().max(2_048).nullable().optional(),
  })
  .superRefine((value, context) => {
    if (value.kind === "VIDEO" && !value.mediaUrl) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["mediaUrl"],
        message: "mediaUrl is required for VIDEO posts",
      });
    }
  });

export type CreateFeedPostInput = z.infer<typeof createFeedPostSchema>;

export const feedPostResponseSchema = z.object({
  post: feedPostSchema,
});

export type FeedPostResponse = z.infer<typeof feedPostResponseSchema>;

export const feedPostListResponseSchema = z.object({
  items: z.array(feedPostSchema),
});

export type FeedPostListResponse = z.infer<
  typeof feedPostListResponseSchema
>;
