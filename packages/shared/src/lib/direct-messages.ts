import { z } from "zod";
import { usernameSchema } from "./auth";
import {
  dmNotificationSettingSchema,
  dmRetentionModeSchema,
  isoDateSchema,
  publicUserSchema,
} from "./common";
import { stickerAssetSchema } from "./stickers";

export const dmMessageContentSchema = z.string().trim().min(1).max(4000);
export const dmMessageTypeSchema = z.enum(["TEXT", "STICKER"]);
export type DmMessageType = z.infer<typeof dmMessageTypeSchema>;

export const openDirectConversationSchema = z.object({
  username: usernameSchema,
});

export type OpenDirectConversationInput = z.infer<
  typeof openDirectConversationSchema
>;

export const createDirectMessageSchema = z
  .object({
    type: dmMessageTypeSchema.default("TEXT"),
    content: z.string().trim().max(4000).nullable().optional(),
    stickerId: z.string().cuid().nullable().optional(),
    clientNonce: z.string().trim().min(1).max(120).optional(),
  })
  .superRefine((value, context) => {
    if (value.type === "TEXT") {
      if (!value.content || value.content.trim().length === 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["content"],
          message: "content is required for TEXT messages",
        });
      }

      if (value.stickerId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["stickerId"],
          message: "stickerId is allowed only for STICKER messages",
        });
      }

      return;
    }

    if (!value.stickerId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["stickerId"],
        message: "stickerId is required for STICKER messages",
      });
    }

    if (value.content && value.content.trim().length > 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["content"],
        message: "content must be empty for STICKER messages",
      });
    }
  });

export type CreateDirectMessageInput = z.infer<
  typeof createDirectMessageSchema
>;

export const updateDmSettingsSchema = z
  .object({
    notificationSetting: dmNotificationSettingSchema.optional(),
    retentionMode: dmRetentionModeSchema.optional(),
    customHours: z
      .number()
      .int()
      .positive()
      .max(24 * 365)
      .nullable()
      .optional(),
  })
  .superRefine((value, context) => {
    if (value.retentionMode === "CUSTOM" && !value.customHours) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customHours"],
        message: "customHours is required for CUSTOM retention",
      });
    }

    if (
      value.retentionMode &&
      value.retentionMode !== "CUSTOM" &&
      value.customHours
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customHours"],
        message: "customHours is allowed only for CUSTOM retention",
      });
    }

    if (
      !value.notificationSetting &&
      !value.retentionMode &&
      value.customHours === undefined
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one setting must be provided",
        path: ["notificationSetting"],
      });
    }
  });

export type UpdateDmSettingsInput = z.infer<typeof updateDmSettingsSchema>;

export const directMessageSchema = z.object({
  id: z.string().cuid(),
  conversationId: z.string().cuid(),
  type: dmMessageTypeSchema,
  author: publicUserSchema,
  content: z.string().nullable(),
  sticker: stickerAssetSchema.nullable(),
  isDeleted: z.boolean(),
  canDelete: z.boolean(),
  deleteExpiresAt: isoDateSchema.nullable(),
  clientNonce: z.string().nullable().optional(),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
});

export type DirectMessage = z.infer<typeof directMessageSchema>;

export const directConversationParticipantSchema = z.object({
  user: publicUserSchema,
  notificationSetting: dmNotificationSettingSchema,
  lastReadMessageId: z.string().cuid().nullable(),
  lastReadAt: isoDateSchema.nullable(),
});

export type DirectConversationParticipant = z.infer<
  typeof directConversationParticipantSchema
>;

export const directConversationSummarySchema = z.object({
  id: z.string().cuid(),
  lastMessageAt: isoDateSchema.nullable(),
  unreadCount: z.number().int().nonnegative(),
  retentionMode: dmRetentionModeSchema,
  retentionSeconds: z.number().int().positive().nullable(),
  counterpart: publicUserSchema,
  settings: z.object({
    notificationSetting: dmNotificationSettingSchema,
    lastReadMessageId: z.string().cuid().nullable(),
    lastReadAt: isoDateSchema.nullable(),
  }),
  lastMessagePreview: z.string().nullable(),
  lastMessage: directMessageSchema.nullable(),
  isBlockedByViewer: z.boolean(),
  hasBlockedViewer: z.boolean(),
});

export type DirectConversationSummary = z.infer<
  typeof directConversationSummarySchema
>;

export const directConversationDetailSchema = z.object({
  conversation: z.object({
    id: z.string().cuid(),
    retentionMode: dmRetentionModeSchema,
    retentionSeconds: z.number().int().positive().nullable(),
    isBlockedByViewer: z.boolean(),
    hasBlockedViewer: z.boolean(),
    participants: z.array(directConversationParticipantSchema),
    messages: z.array(directMessageSchema),
  }),
});

export type DirectConversationDetail = z.infer<
  typeof directConversationDetailSchema
>;

export const directConversationSummaryResponseSchema = z.object({
  conversation: directConversationSummarySchema,
});

export type DirectConversationSummaryResponse = z.infer<
  typeof directConversationSummaryResponseSchema
>;

export const directConversationListResponseSchema = z.object({
  items: z.array(directConversationSummarySchema),
});

export type DirectConversationListResponse = z.infer<
  typeof directConversationListResponseSchema
>;

export const directMessageResponseSchema = z.object({
  message: directMessageSchema,
});

export type DirectMessageResponse = z.infer<typeof directMessageResponseSchema>;

export const dmSignalSchema = z.object({
  event: z.enum([
    "MESSAGE_CREATED",
    "MESSAGE_DELETED",
    "CONVERSATION_READ",
    "CONVERSATION_UPDATED",
  ]),
  conversationId: z.string().cuid(),
  conversation: directConversationSummarySchema,
  message: directMessageSchema.nullable(),
  messageId: z.string().cuid().nullable(),
  actorUserId: z.string().cuid().nullable(),
});

export type DmSignal = z.infer<typeof dmSignalSchema>;
