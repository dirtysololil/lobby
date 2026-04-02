import { z } from "zod";
import { notificationSettingSchema } from "./common";

export const updateHubNotificationSettingSchema = z.object({
  notificationSetting: notificationSettingSchema,
});

export type UpdateHubNotificationSettingInput = z.infer<
  typeof updateHubNotificationSettingSchema
>;

export const updateLobbyNotificationSettingSchema = z.object({
  notificationSetting: notificationSettingSchema,
});

export type UpdateLobbyNotificationSettingInput = z.infer<
  typeof updateLobbyNotificationSettingSchema
>;

export const hubNotificationSettingResponseSchema = z.object({
  hubId: z.string().cuid(),
  notificationSetting: notificationSettingSchema,
});

export type HubNotificationSettingResponse = z.infer<
  typeof hubNotificationSettingResponseSchema
>;

export const lobbyNotificationSettingResponseSchema = z.object({
  lobbyId: z.string().cuid(),
  notificationSetting: notificationSettingSchema,
});

export type LobbyNotificationSettingResponse = z.infer<
  typeof lobbyNotificationSettingResponseSchema
>;
