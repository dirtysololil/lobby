import { z } from "zod";
import {
  callModeSchema,
  callParticipantStateSchema,
  callScopeSchema,
  callStatusSchema,
  isoDateSchema,
  publicUserSchema,
} from "./common";

export const startDmCallSchema = z.object({
  mode: callModeSchema,
});

export type StartDmCallInput = z.infer<typeof startDmCallSchema>;

export const callParticipantSchema = z.object({
  user: publicUserSchema,
  state: callParticipantStateSchema,
  invitedAt: isoDateSchema,
  respondedAt: isoDateSchema.nullable(),
  joinedAt: isoDateSchema.nullable(),
  leftAt: isoDateSchema.nullable(),
});

export type CallParticipant = z.infer<typeof callParticipantSchema>;

export const callSummarySchema = z.object({
  id: z.string().cuid(),
  scope: callScopeSchema,
  mode: callModeSchema,
  status: callStatusSchema,
  dmConversationId: z.string().cuid().nullable(),
  hubId: z.string().cuid().nullable(),
  lobbyId: z.string().cuid().nullable(),
  livekitRoomName: z.string().min(1),
  initiatedBy: publicUserSchema,
  acceptedAt: isoDateSchema.nullable(),
  endedAt: isoDateSchema.nullable(),
  createdAt: isoDateSchema,
  participants: z.array(callParticipantSchema),
});

export type CallSummary = z.infer<typeof callSummarySchema>;

export const callStateResponseSchema = z.object({
  activeCall: callSummarySchema.nullable(),
  history: z.array(callSummarySchema),
});

export type CallStateResponse = z.infer<typeof callStateResponseSchema>;

export const callResponseSchema = z.object({
  call: callSummarySchema,
});

export type CallResponse = z.infer<typeof callResponseSchema>;

export const callTokenResponseSchema = z.object({
  call: callSummarySchema,
  connection: z.object({
    callId: z.string().cuid(),
    url: z.string().url(),
    roomName: z.string().min(1),
    token: z.string().min(1),
    canPublishMedia: z.boolean(),
  }),
});

export type CallTokenResponse = z.infer<typeof callTokenResponseSchema>;

export const callSignalSchema = z.object({
  event: z.enum([
    "CALL_CREATED",
    "CALL_UPDATED",
    "CALL_ENDED",
    "CALL_MISSED",
  ]),
  call: callSummarySchema,
});

export type CallSignal = z.infer<typeof callSignalSchema>;

export const subscribeDmCallsSchema = z.object({
  conversationId: z.string().cuid(),
});

export type SubscribeDmCallsInput = z.infer<typeof subscribeDmCallsSchema>;

export const subscribeLobbyCallsSchema = z.object({
  hubId: z.string().cuid(),
  lobbyId: z.string().cuid(),
});

export type SubscribeLobbyCallsInput = z.infer<
  typeof subscribeLobbyCallsSchema
>;
