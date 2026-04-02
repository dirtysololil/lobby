import { z } from "zod";
import { isoDateSchema, userRoleSchema } from "./common";

export const inviteIdSchema = z.string().cuid();

export const inviteSummarySchema = z.object({
  id: inviteIdSchema,
  label: z.string().nullable(),
  role: userRoleSchema,
  maxUses: z.number().int().positive(),
  usedCount: z.number().int().nonnegative(),
  expiresAt: isoDateSchema.nullable(),
  revokedAt: isoDateSchema.nullable(),
  createdAt: isoDateSchema,
  createdByUserId: z.string().cuid().nullable(),
});

export type InviteSummary = z.infer<typeof inviteSummarySchema>;

export const inviteListResponseSchema = z.object({
  items: z.array(inviteSummarySchema),
});

export type InviteListResponse = z.infer<typeof inviteListResponseSchema>;

export const createInviteSchema = z.object({
  label: z.string().trim().min(1).max(120).nullable().optional(),
  role: userRoleSchema.default("MEMBER"),
  maxUses: z.number().int().positive().max(10_000),
  expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
});

export type CreateInviteInput = z.infer<typeof createInviteSchema>;

export const updateInviteSchema = z.object({
  label: z.string().trim().min(1).max(120).nullable().optional(),
  role: userRoleSchema.optional(),
  maxUses: z.number().int().positive().max(10_000).optional(),
  expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
});

export type UpdateInviteInput = z.infer<typeof updateInviteSchema>;

export const inviteCreateResponseSchema = z.object({
  invite: inviteSummarySchema,
  rawCode: z.string(),
});

export type InviteCreateResponse = z.infer<typeof inviteCreateResponseSchema>;

export const inviteResponseSchema = z.object({
  invite: inviteSummarySchema,
});

export type InviteResponse = z.infer<typeof inviteResponseSchema>;
