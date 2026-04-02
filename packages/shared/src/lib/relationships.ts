import { z } from "zod";
import {
  isoDateSchema,
  publicUserSchema,
  userRelationshipSummarySchema,
} from "./common";

export const usernameSearchSchema = z.object({
  query: z
    .string()
    .trim()
    .min(1)
    .max(24)
    .regex(/^[a-z0-9_]+$/),
});

export type UsernameSearchInput = z.infer<typeof usernameSearchSchema>;

export const userSearchResultSchema = z.object({
  user: publicUserSchema,
  relationship: userRelationshipSummarySchema,
});

export type UserSearchResult = z.infer<typeof userSearchResultSchema>;

export const userSearchResponseSchema = z.object({
  items: z.array(userSearchResultSchema),
});

export type UserSearchResponse = z.infer<typeof userSearchResponseSchema>;

export const friendshipRecordSchema = z.object({
  id: z.string().cuid(),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
  respondedAt: isoDateSchema.nullable(),
  otherUser: publicUserSchema,
  state: z.enum(["INCOMING_REQUEST", "OUTGOING_REQUEST", "ACCEPTED", "REMOVED"]),
});

export type FriendshipRecord = z.infer<typeof friendshipRecordSchema>;

export const friendshipsResponseSchema = z.object({
  items: z.array(friendshipRecordSchema),
});

export type FriendshipsResponse = z.infer<typeof friendshipsResponseSchema>;

export const blockRecordSchema = z.object({
  id: z.string().cuid(),
  createdAt: isoDateSchema,
  blockedUser: publicUserSchema,
});

export type BlockRecord = z.infer<typeof blockRecordSchema>;

export const blocksResponseSchema = z.object({
  items: z.array(blockRecordSchema),
});

export type BlocksResponse = z.infer<typeof blocksResponseSchema>;

export const friendshipActionSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(24)
    .regex(/^[a-z0-9_]+$/),
});

export type FriendshipActionInput = z.infer<typeof friendshipActionSchema>;

export const blockActionSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(24)
    .regex(/^[a-z0-9_]+$/),
});

export type BlockActionInput = z.infer<typeof blockActionSchema>;

export const friendshipResponseSchema = z.object({
  friendship: friendshipRecordSchema,
});

export type FriendshipResponse = z.infer<typeof friendshipResponseSchema>;

export const blockResponseSchema = z.object({
  block: blockRecordSchema,
});

export type BlockResponse = z.infer<typeof blockResponseSchema>;

export const actionMessageSchema = z.object({
  ok: z.literal(true),
});

export type ActionMessage = z.infer<typeof actionMessageSchema>;
