import {
  callParticipantSchema,
  callSummarySchema,
  type CallParticipant,
  type CallSummary,
} from '@lobby/shared';
import { Prisma } from '@prisma/client';
import { publicUserSelect, toPublicUser } from '../auth/auth.mapper';

export const callParticipantWithUserInclude = {
  user: {
    select: publicUserSelect,
  },
} satisfies Prisma.CallParticipantInclude;

export const callSessionInclude = {
  initiatedByUser: {
    select: publicUserSelect,
  },
  participants: {
    include: callParticipantWithUserInclude,
    orderBy: {
      invitedAt: 'asc',
    },
  },
} satisfies Prisma.CallSessionInclude;

export type CallParticipantRecord = Prisma.CallParticipantGetPayload<{
  include: typeof callParticipantWithUserInclude;
}>;

export type CallSessionRecord = Prisma.CallSessionGetPayload<{
  include: typeof callSessionInclude;
}>;

export function toCallParticipant(
  participant: CallParticipantRecord,
): CallParticipant {
  return callParticipantSchema.parse({
    user: toPublicUser(participant.user),
    state: participant.state,
    invitedAt: participant.invitedAt.toISOString(),
    respondedAt: participant.respondedAt?.toISOString() ?? null,
    joinedAt: participant.joinedAt?.toISOString() ?? null,
    leftAt: participant.leftAt?.toISOString() ?? null,
  });
}

export function toCallSummary(call: CallSessionRecord): CallSummary {
  return callSummarySchema.parse({
    id: call.id,
    scope: call.scope,
    mode: call.mode,
    status: call.status,
    dmConversationId: call.dmConversationId,
    hubId: call.hubId,
    lobbyId: call.lobbyId,
    livekitRoomName: call.livekitRoomName,
    initiatedBy: toPublicUser(call.initiatedByUser),
    acceptedAt: call.acceptedAt?.toISOString() ?? null,
    endedAt: call.endedAt?.toISOString() ?? null,
    createdAt: call.createdAt.toISOString(),
    participants: call.participants.map((participant) =>
      toCallParticipant(participant),
    ),
  });
}
