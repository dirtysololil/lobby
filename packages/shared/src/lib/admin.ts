import { z } from "zod";
import { inviteSummarySchema } from "./invites";
import { isoDateSchema, publicUserSchema, userRoleSchema } from "./common";

export const platformBlockSchema = z.object({
  id: z.string().cuid(),
  reason: z.string().nullable(),
  createdAt: isoDateSchema,
  blockedBy: publicUserSchema,
});

export type PlatformBlock = z.infer<typeof platformBlockSchema>;

export const adminOverviewSchema = z.object({
  counts: z.object({
    users: z.number().int().nonnegative(),
    blockedUsers: z.number().int().nonnegative(),
    invites: z.number().int().nonnegative(),
    hubs: z.number().int().nonnegative(),
    auditEvents: z.number().int().nonnegative(),
  }),
  recentInvites: z.array(inviteSummarySchema),
});

export type AdminOverview = z.infer<typeof adminOverviewSchema>;

export const adminOverviewResponseSchema = z.object({
  overview: adminOverviewSchema,
});

export type AdminOverviewResponse = z.infer<typeof adminOverviewResponseSchema>;

export const listAdminUsersQuerySchema = z.object({
  query: z.string().trim().max(64).default(""),
  role: userRoleSchema.optional(),
  blocked: z.enum(["all", "blocked", "active"]).default("all"),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(20),
});

export type ListAdminUsersQuery = z.infer<typeof listAdminUsersQuerySchema>;

export const adminUserSummarySchema = z.object({
  user: publicUserSchema,
  activeSessionCount: z.number().int().nonnegative(),
  hubMembershipCount: z.number().int().nonnegative(),
  lastSeenAt: isoDateSchema.nullable(),
  platformBlock: platformBlockSchema.nullable(),
});

export type AdminUserSummary = z.infer<typeof adminUserSummarySchema>;

export const adminUserListResponseSchema = z.object({
  items: z.array(adminUserSummarySchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
});

export type AdminUserListResponse = z.infer<typeof adminUserListResponseSchema>;

export const adminUserDetailResponseSchema = z.object({
  item: adminUserSummarySchema,
});

export type AdminUserDetailResponse = z.infer<
  typeof adminUserDetailResponseSchema
>;

export const updateAdminUserRoleSchema = z.object({
  role: userRoleSchema,
});

export type UpdateAdminUserRoleInput = z.infer<typeof updateAdminUserRoleSchema>;

export const upsertPlatformBlockSchema = z.object({
  reason: z.string().trim().max(240).nullable().optional(),
});

export type UpsertPlatformBlockInput = z.infer<
  typeof upsertPlatformBlockSchema
>;

export const adminAuditLogItemSchema = z.object({
  id: z.string().cuid(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string().nullable(),
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  metadata: z.unknown().nullable(),
  createdAt: isoDateSchema,
  actor: publicUserSchema.nullable(),
});

export type AdminAuditLogItem = z.infer<typeof adminAuditLogItemSchema>;

export const listAdminAuditQuerySchema = z.object({
  action: z.string().trim().max(120).optional(),
  entityType: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
});

export type ListAdminAuditQuery = z.infer<typeof listAdminAuditQuerySchema>;

export const adminAuditLogListResponseSchema = z.object({
  items: z.array(adminAuditLogItemSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
});

export type AdminAuditLogListResponse = z.infer<
  typeof adminAuditLogListResponseSchema
>;
