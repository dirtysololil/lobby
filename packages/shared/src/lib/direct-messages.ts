import { z } from "zod";
import { usernameSchema } from "./auth";
import {
  actionMessageSchema,
  dmNotificationSettingSchema,
  dmRetentionModeSchema,
  isoDateSchema,
  publicUserSchema,
} from "./common";
import { gifAssetSchema } from "./media-library";
import { stickerAssetSchema } from "./stickers";

export const dmMessageContentSchema = z.string().trim().min(1).max(4000);
export const dmMessageTypeSchema = z.enum([
  "TEXT",
  "STICKER",
  "GIF",
  "MEDIA",
  "FILE",
]);
export type DmMessageType = z.infer<typeof dmMessageTypeSchema>;

const dmComposerMessageTypeSchema = z.enum(["TEXT", "STICKER", "GIF"]);

export const dmLinkEmbedProviderSchema = z.enum([
  "TENOR",
  "DIRECT_MEDIA",
  "OPEN_GRAPH",
]);
export type DmLinkEmbedProvider = z.infer<typeof dmLinkEmbedProviderSchema>;

export const dmLinkEmbedStatusSchema = z.enum(["PENDING", "READY", "FAILED"]);
export type DmLinkEmbedStatus = z.infer<typeof dmLinkEmbedStatusSchema>;

export const dmLinkEmbedKindSchema = z.enum(["IMAGE", "VIDEO", "GIF"]);
export type DmLinkEmbedKind = z.infer<typeof dmLinkEmbedKindSchema>;

export const dmLinkEmbedSchema = z.object({
  status: dmLinkEmbedStatusSchema,
  provider: dmLinkEmbedProviderSchema,
  kind: dmLinkEmbedKindSchema.nullable(),
  sourceUrl: z.string().url(),
  canonicalUrl: z.string().url().nullable(),
  previewUrl: z.string().url().nullable(),
  playableUrl: z.string().url().nullable(),
  posterUrl: z.string().url().nullable(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  aspectRatio: z.number().positive().nullable(),
  failureCode: z.string().trim().max(120).nullable().optional(),
});

export type DmLinkEmbed = z.infer<typeof dmLinkEmbedSchema>;

export const dmAttachmentKindSchema = z.enum(["IMAGE", "VIDEO", "DOCUMENT"]);
export type DmAttachmentKind = z.infer<typeof dmAttachmentKindSchema>;

export const dmAttachmentSchema = z.object({
  id: z.string().cuid(),
  kind: dmAttachmentKindSchema,
  originalName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(191),
  fileSize: z.number().int().positive(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  durationMs: z.number().int().positive().nullable(),
  hasPreview: z.boolean(),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
});

export type DmAttachment = z.infer<typeof dmAttachmentSchema>;

export const openDirectConversationSchema = z.object({
  username: usernameSchema,
});

export type OpenDirectConversationInput = z.infer<
  typeof openDirectConversationSchema
>;

export const createDirectMessageSchema = z
  .object({
    type: dmComposerMessageTypeSchema.default("TEXT"),
    content: z.string().trim().max(4000).nullable().optional(),
    stickerId: z.string().cuid().nullable().optional(),
    gifId: z.string().cuid().nullable().optional(),
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

      if (value.gifId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["gifId"],
          message: "gifId is allowed only for GIF messages",
        });
      }

      return;
    }

    if (value.content && value.content.trim().length > 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["content"],
        message: "content must be empty for media messages",
      });
    }

    if (value.type === "STICKER") {
      if (!value.stickerId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["stickerId"],
          message: "stickerId is required for STICKER messages",
        });
      }

      if (value.gifId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["gifId"],
          message: "gifId is allowed only for GIF messages",
        });
      }

      return;
    }

    if (!value.gifId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["gifId"],
        message: "gifId is required for GIF messages",
      });
    }

    if (value.stickerId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["stickerId"],
        message: "stickerId is allowed only for STICKER messages",
      });
    }
  });

export type CreateDirectMessageInput = z.infer<
  typeof createDirectMessageSchema
>;

export const uploadDirectMessageAttachmentSchema = z.object({
  clientNonce: z.string().trim().min(1).max(120).optional(),
});

export type UploadDirectMessageAttachmentInput = z.infer<
  typeof uploadDirectMessageAttachmentSchema
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
  gif: gifAssetSchema.nullable(),
  attachment: dmAttachmentSchema.nullable(),
  linkEmbed: dmLinkEmbedSchema.nullable(),
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

export const directMessageAttachmentResponseSchema = z.object({
  message: directMessageSchema,
});

export type DirectMessageAttachmentResponse = z.infer<
  typeof directMessageAttachmentResponseSchema
>;

export const directMessageAttachmentUploadResponseSchema =
  directMessageAttachmentResponseSchema;

export type DirectMessageAttachmentUploadResponse = z.infer<
  typeof directMessageAttachmentUploadResponseSchema
>;

export const directMessageActionResponseSchema = actionMessageSchema;

export type DirectMessageActionResponse = z.infer<
  typeof directMessageActionResponseSchema
>;

export const dmConversationReadStateSchema = z.object({
  userId: z.string().cuid(),
  lastReadMessageId: z.string().cuid().nullable(),
  lastReadAt: isoDateSchema.nullable(),
});

export type DmConversationReadState = z.infer<
  typeof dmConversationReadStateSchema
>;

export const dmSignalSchema = z.object({
  event: z.enum([
    "MESSAGE_CREATED",
    "MESSAGE_UPDATED",
    "MESSAGE_DELETED",
    "CONVERSATION_READ",
    "CONVERSATION_UPDATED",
  ]),
  conversationId: z.string().cuid(),
  conversation: directConversationSummarySchema,
  message: directMessageSchema.nullable(),
  messageId: z.string().cuid().nullable(),
  actorUserId: z.string().cuid().nullable(),
  readState: dmConversationReadStateSchema.nullable().optional(),
});

export type DmSignal = z.infer<typeof dmSignalSchema>;
