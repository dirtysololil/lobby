import { z } from "zod";
import { isoDateSchema, publicUserSchema } from "./common";

export const forumTagSchema = z.object({
  id: z.string().cuid(),
  name: z.string(),
  slug: z.string(),
});

export type ForumTag = z.infer<typeof forumTagSchema>;

export const forumTopicSchema = z.object({
  id: z.string().cuid(),
  hubId: z.string().cuid(),
  lobbyId: z.string().cuid(),
  title: z.string(),
  content: z.string(),
  pinned: z.boolean(),
  locked: z.boolean(),
  archived: z.boolean(),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
  lastActivityAt: isoDateSchema,
  author: publicUserSchema,
  tags: z.array(forumTagSchema),
  repliesCount: z.number().int().nonnegative(),
});

export type ForumTopic = z.infer<typeof forumTopicSchema>;

export const forumTopicListResponseSchema = z.object({
  items: z.array(forumTopicSchema),
});

export type ForumTopicListResponse = z.infer<typeof forumTopicListResponseSchema>;

export const createForumTopicSchema = z.object({
  title: z.string().trim().min(3).max(160),
  content: z.string().trim().min(1).max(10_000),
  tags: z.array(z.string().trim().min(1).max(32)).max(10).default([]),
});

export type CreateForumTopicInput = z.infer<typeof createForumTopicSchema>;

export const forumReplySchema = z.object({
  id: z.string().cuid(),
  topicId: z.string().cuid(),
  content: z.string(),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
  author: publicUserSchema,
});

export type ForumReply = z.infer<typeof forumReplySchema>;

export const forumTopicDetailSchema = z.object({
  topic: forumTopicSchema.extend({
    replies: z.array(forumReplySchema),
  }),
});

export type ForumTopicDetail = z.infer<typeof forumTopicDetailSchema>;

export const createForumReplySchema = z.object({
  content: z.string().trim().min(1).max(10_000),
});

export type CreateForumReplyInput = z.infer<typeof createForumReplySchema>;

export const forumReplyResponseSchema = z.object({
  reply: forumReplySchema,
});

export type ForumReplyResponse = z.infer<typeof forumReplyResponseSchema>;

export const forumTopicResponseSchema = z.object({
  topic: forumTopicSchema,
});

export type ForumTopicResponse = z.infer<typeof forumTopicResponseSchema>;

export const updateForumTopicStateSchema = z.object({
  pinned: z.boolean().optional(),
  locked: z.boolean().optional(),
  archived: z.boolean().optional(),
});

export type UpdateForumTopicStateInput = z.infer<typeof updateForumTopicStateSchema>;
