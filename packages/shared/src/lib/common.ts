import { z } from "zod";

export const userRoleSchema = z.enum(["OWNER", "ADMIN", "MEMBER"]);
export type UserRole = z.infer<typeof userRoleSchema>;

export const presenceStatusSchema = z.enum([
  "ONLINE",
  "IDLE",
  "DND",
  "OFFLINE",
]);
export type PresenceStatus = z.infer<typeof presenceStatusSchema>;

export const avatarPresetSchema = z.enum([
  "NONE",
  "GOLD_GLOW",
  "NEON_BLUE",
  "PREMIUM_PURPLE",
  "ANIMATED_RING",
]);
export type AvatarPreset = z.infer<typeof avatarPresetSchema>;

export const callRingtonePresetSchema = z.enum([
  "CLASSIC",
  "SOFT",
  "DIGITAL",
  "PULSE",
  "NIGHT",
  "CLEAR_SIGNAL",
]);
export type CallRingtonePreset = z.infer<typeof callRingtonePresetSchema>;
export const defaultCallRingtonePreset: CallRingtonePreset = "CLASSIC";
export const callRingtoneModeSchema = z.enum(["BUILTIN", "CUSTOM"]);
export type CallRingtoneMode = z.infer<typeof callRingtoneModeSchema>;
export const defaultCallRingtoneMode: CallRingtoneMode = "BUILTIN";

export const hubMemberRoleSchema = z.enum([
  "OWNER",
  "ADMIN",
  "MODERATOR",
  "MEMBER",
]);
export type HubMemberRole = z.infer<typeof hubMemberRoleSchema>;

export const hubInviteStatusSchema = z.enum([
  "PENDING",
  "ACCEPTED",
  "DECLINED",
  "REVOKED",
]);
export type HubInviteStatus = z.infer<typeof hubInviteStatusSchema>;

export const lobbyTypeSchema = z.enum(["TEXT", "VOICE", "FORUM"]);
export type LobbyType = z.infer<typeof lobbyTypeSchema>;

export const callScopeSchema = z.enum(["DM", "HUB_LOBBY"]);
export type CallScope = z.infer<typeof callScopeSchema>;

export const callModeSchema = z.enum(["AUDIO", "VIDEO"]);
export type CallMode = z.infer<typeof callModeSchema>;

export const callStatusSchema = z.enum([
  "RINGING",
  "ACCEPTED",
  "DECLINED",
  "ENDED",
  "MISSED",
]);
export type CallStatus = z.infer<typeof callStatusSchema>;

export const callParticipantStateSchema = z.enum([
  "INVITED",
  "ACCEPTED",
  "JOINED",
  "DECLINED",
  "LEFT",
  "MISSED",
]);
export type CallParticipantState = z.infer<typeof callParticipantStateSchema>;

export const dmNotificationSettingSchema = z.enum([
  "ALL",
  "MENTIONS_ONLY",
  "MUTED",
  "OFF",
]);
export type DmNotificationSetting = z.infer<typeof dmNotificationSettingSchema>;

export const notificationSettingSchema = dmNotificationSettingSchema;
export type NotificationSetting = DmNotificationSetting;

export const dmRetentionModeSchema = z.enum([
  "OFF",
  "H24",
  "D7",
  "D30",
  "CUSTOM",
]);
export type DmRetentionMode = z.infer<typeof dmRetentionModeSchema>;

export const friendshipStateSchema = z.enum([
  "NONE",
  "INCOMING_REQUEST",
  "OUTGOING_REQUEST",
  "ACCEPTED",
  "REMOVED",
]);
export type FriendshipState = z.infer<typeof friendshipStateSchema>;

export const isoDateSchema = z.string().datetime({ offset: true });

export const avatarMetadataSchema = z.object({
  fileKey: z.string().nullable(),
  originalName: z.string().nullable(),
  mimeType: z.string().nullable(),
  bytes: z.number().int().nonnegative().nullable(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  frameCount: z.number().int().positive().nullable(),
  animationDurationMs: z.number().int().nonnegative().nullable(),
  isAnimated: z.boolean(),
});

export type AvatarMetadata = z.infer<typeof avatarMetadataSchema>;

export const ringtoneMetadataSchema = z.object({
  fileKey: z.string().nullable(),
  originalName: z.string().nullable(),
  mimeType: z.string().nullable(),
  bytes: z.number().int().nonnegative().nullable(),
});

export type RingtoneMetadata = z.infer<typeof ringtoneMetadataSchema>;

export const profileSchema = z.object({
  displayName: z.string(),
  bio: z.string().nullable(),
  presence: presenceStatusSchema,
  avatarPreset: avatarPresetSchema,
  avatar: avatarMetadataSchema,
  callRingtonePreset: callRingtonePresetSchema,
  callRingtoneMode: callRingtoneModeSchema,
  customRingtone: ringtoneMetadataSchema,
  updatedAt: isoDateSchema,
});

export type Profile = z.infer<typeof profileSchema>;

export const publicUserSchema = z.object({
  id: z.string().cuid(),
  username: z.string(),
  email: z.string().email(),
  role: userRoleSchema,
  isOnline: z.boolean(),
  lastSeenAt: isoDateSchema.nullable(),
  profile: profileSchema,
  createdAt: isoDateSchema,
});

export type PublicUser = z.infer<typeof publicUserSchema>;

export const userRelationshipSummarySchema = z.object({
  friendshipId: z.string().cuid().nullable(),
  blockId: z.string().cuid().nullable(),
  friendshipState: friendshipStateSchema,
  isBlockedByViewer: z.boolean(),
  hasBlockedViewer: z.boolean(),
  dmConversationId: z.string().cuid().nullable(),
});

export type UserRelationshipSummary = z.infer<
  typeof userRelationshipSummarySchema
>;

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

export type ApiError = z.infer<typeof apiErrorSchema>;

export const actionMessageSchema = z.object({
  ok: z.literal(true),
});

export type ActionMessage = z.infer<typeof actionMessageSchema>;
