import { z } from "zod";
import {
  avatarPresetSchema,
  callRingtoneModeSchema,
  callRingtonePresetSchema,
  notificationSettingSchema,
  publicUserSchema,
  presenceStatusSchema,
} from "./common";

export const updateProfileSchema = z.object({
  email: z.string().trim().email(),
  displayName: z.string().trim().min(2).max(40),
  fullName: z.string().trim().max(120).nullable(),
  bio: z.string().trim().max(240).nullable(),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  phone: z.string().trim().max(32).nullable(),
  statusEmoji: z.string().trim().max(16).nullable(),
  presence: presenceStatusSchema,
  avatarPreset: avatarPresetSchema,
  callRingtonePreset: callRingtonePresetSchema,
  callRingtoneMode: callRingtoneModeSchema,
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const viewerNotificationDefaultsSchema = z.object({
  dmNotificationDefault: notificationSettingSchema,
  hubNotificationDefault: notificationSettingSchema,
  lobbyNotificationDefault: notificationSettingSchema,
});

export type ViewerNotificationDefaults = z.infer<
  typeof viewerNotificationDefaultsSchema
>;

export const updateViewerNotificationDefaultsSchema =
  viewerNotificationDefaultsSchema;

export type UpdateViewerNotificationDefaultsInput = z.infer<
  typeof updateViewerNotificationDefaultsSchema
>;

export const userNotificationSettingsOverviewSchema = z.object({
  defaults: viewerNotificationDefaultsSchema,
  hubs: z.array(
    z.object({
      hubId: z.string().cuid(),
      hubName: z.string(),
      setting: notificationSettingSchema,
    }),
  ),
  lobbies: z.array(
    z.object({
      hubId: z.string().cuid(),
      hubName: z.string(),
      lobbyId: z.string().cuid(),
      lobbyName: z.string(),
      setting: notificationSettingSchema,
      inherited: z.boolean(),
    }),
  ),
});

export type UserNotificationSettingsOverview = z.infer<
  typeof userNotificationSettingsOverviewSchema
>;

export const userNotificationSettingsResponseSchema = z.object({
  settings: userNotificationSettingsOverviewSchema,
});

export type UserNotificationSettingsResponse = z.infer<
  typeof userNotificationSettingsResponseSchema
>;

export const userResponseSchema = z.object({
  user: publicUserSchema,
});

export type UserResponse = z.infer<typeof userResponseSchema>;
