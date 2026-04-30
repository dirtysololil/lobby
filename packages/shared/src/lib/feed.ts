import { z } from "zod";
import {
  contentReactionSchema,
  isoDateSchema,
  publicUserSchema,
} from "./common";

export const feedPostKindSchema = z.enum(["ARTICLE", "VIDEO"]);
export type FeedPostKind = z.infer<typeof feedPostKindSchema>;

export const feedPostSchema = z.object({
  id: z.string().cuid(),
  kind: feedPostKindSchema,
  title: z.string().nullable(),
  body: z.string(),
  mediaUrl: z.string().url().nullable(),
  author: publicUserSchema,
  reactions: z.array(contentReactionSchema),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
});

export type FeedPost = z.infer<typeof feedPostSchema>;

export const createFeedPostSchema = z
  .object({
    kind: feedPostKindSchema.default("ARTICLE"),
    title: z.string().trim().max(160).nullable().optional(),
    body: z.string().trim().max(10_000).optional().default(""),
    mediaUrl: z.string().trim().max(2_048).nullable().optional(),
  })
  .superRefine((value, context) => {
    if (!value.body?.trim() && !value.mediaUrl) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["body"],
        message: "body or mediaUrl is required for posts",
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
