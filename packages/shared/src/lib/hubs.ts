import { z } from "zod";
import {
  hubInviteStatusSchema,
  hubMemberRoleSchema,
  isoDateSchema,
  lobbyTypeSchema,
  notificationSettingSchema,
  publicUserSchema,
} from "./common";
import { usernameSchema } from "./auth";

export const hubPermissionSchema = z.object({
  canCreateLobby: z.boolean(),
  canInviteMembers: z.boolean(),
  canManageMembers: z.boolean(),
  canModerateForum: z.boolean(),
  canManageHub: z.boolean(),
});

export type HubPermission = z.infer<typeof hubPermissionSchema>;

export const hubSummarySchema = z.object({
  id: z.string().cuid(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  isPrivate: z.boolean(),
  createdAt: isoDateSchema,
  membershipRole: hubMemberRoleSchema.nullable(),
});

export type HubSummary = z.infer<typeof hubSummarySchema>;

export const hubListResponseSchema = z.object({
  items: z.array(hubSummarySchema),
});

export type HubListResponse = z.infer<typeof hubListResponseSchema>;

export const createHubSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z
    .string()
    .trim()
    .min(3)
    .max(48)
    .regex(/^[a-z0-9-]+$/),
  description: z.string().trim().max(240).nullable().optional(),
  isPrivate: z.boolean().default(false),
});

export type CreateHubInput = z.infer<typeof createHubSchema>;

export const lobbySummarySchema = z.object({
  id: z.string().cuid(),
  hubId: z.string().cuid(),
  name: z.string(),
  description: z.string().nullable(),
  type: lobbyTypeSchema,
  isPrivate: z.boolean(),
  createdAt: isoDateSchema,
  canAccess: z.boolean(),
  notificationSetting: notificationSettingSchema,
});

export type LobbySummary = z.infer<typeof lobbySummarySchema>;

export const hubMemberSchema = z.object({
  id: z.string().cuid(),
  role: hubMemberRoleSchema,
  joinedAt: isoDateSchema,
  notificationSetting: notificationSettingSchema,
  user: publicUserSchema,
  canManage: z.boolean(),
});

export type HubMember = z.infer<typeof hubMemberSchema>;

export const hubInviteSchema = z.object({
  id: z.string().cuid(),
  hubId: z.string().cuid(),
  status: hubInviteStatusSchema,
  expiresAt: isoDateSchema.nullable(),
  respondedAt: isoDateSchema.nullable(),
  createdAt: isoDateSchema,
  hub: z.object({
    id: z.string().cuid(),
    slug: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    isPrivate: z.boolean(),
    createdAt: isoDateSchema,
    membershipRole: hubMemberRoleSchema.nullable(),
  }),
  invitee: publicUserSchema,
  invitedBy: publicUserSchema,
});

export type HubInvite = z.infer<typeof hubInviteSchema>;

export const hubMuteSchema = z.object({
  id: z.string().cuid(),
  user: publicUserSchema,
  expiresAt: isoDateSchema.nullable(),
  createdAt: isoDateSchema,
});

export type HubMute = z.infer<typeof hubMuteSchema>;

export const hubBanSchema = z.object({
  id: z.string().cuid(),
  user: publicUserSchema,
  reason: z.string().nullable(),
  createdAt: isoDateSchema,
});

export type HubBan = z.infer<typeof hubBanSchema>;

export const hubShellSchema = z.object({
  hub: z.object({
    id: z.string().cuid(),
    slug: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    isPrivate: z.boolean(),
    createdAt: isoDateSchema,
    membershipRole: hubMemberRoleSchema.nullable(),
    isViewerMuted: z.boolean(),
    notificationSetting: notificationSettingSchema.nullable(),
    permissions: hubPermissionSchema,
    lobbies: z.array(lobbySummarySchema),
    members: z.array(hubMemberSchema),
    pendingInvites: z.array(hubInviteSchema),
    activeMutes: z.array(hubMuteSchema),
    activeBans: z.array(hubBanSchema),
  }),
});

export type HubShell = z.infer<typeof hubShellSchema>;

export const hubShellResponseSchema = hubShellSchema;
export type HubShellResponse = z.infer<typeof hubShellResponseSchema>;

export const createLobbySchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(240).nullable().optional(),
  type: lobbyTypeSchema,
  isPrivate: z.boolean().default(false),
  allowedUsernames: z.array(usernameSchema).max(50).default([]),
});

export type CreateLobbyInput = z.infer<typeof createLobbySchema>;

export const updateLobbyAccessSchema = z.object({
  allowedUsernames: z.array(usernameSchema).max(50).default([]),
});

export type UpdateLobbyAccessInput = z.infer<typeof updateLobbyAccessSchema>;

export const lobbyResponseSchema = z.object({
  lobby: lobbySummarySchema,
});

export type LobbyResponse = z.infer<typeof lobbyResponseSchema>;

export const createHubInviteSchema = z.object({
  username: usernameSchema,
  expiresAt: isoDateSchema.nullable().optional(),
});

export type CreateHubInviteInput = z.infer<typeof createHubInviteSchema>;

export const hubInviteResponseSchema = z.object({
  invite: hubInviteSchema,
});

export type HubInviteResponse = z.infer<typeof hubInviteResponseSchema>;

export const viewerHubInvitesResponseSchema = z.object({
  items: z.array(hubInviteSchema),
});

export type ViewerHubInvitesResponse = z.infer<typeof viewerHubInvitesResponseSchema>;

export const updateHubMemberRoleSchema = z.object({
  username: usernameSchema,
  role: z.enum(["ADMIN", "MODERATOR", "MEMBER"]),
});

export type UpdateHubMemberRoleInput = z.infer<typeof updateHubMemberRoleSchema>;

export const userTargetActionSchema = z.object({
  username: usernameSchema,
});

export type UserTargetActionInput = z.infer<typeof userTargetActionSchema>;

export const createHubBanSchema = z.object({
  username: usernameSchema,
  reason: z.string().trim().max(240).nullable().optional(),
});

export type CreateHubBanInput = z.infer<typeof createHubBanSchema>;

export const createHubMuteSchema = z.object({
  username: usernameSchema,
  expiresAt: isoDateSchema.nullable().optional(),
});

export type CreateHubMuteInput = z.infer<typeof createHubMuteSchema>;
