import { inviteSummarySchema, type InviteSummary } from '@lobby/shared';
import type { InviteKey } from '@prisma/client';

export function toInviteSummary(invite: InviteKey): InviteSummary {
  return inviteSummarySchema.parse({
    id: invite.id,
    label: invite.label,
    role: invite.role,
    maxUses: invite.maxUses,
    usedCount: invite.usedCount,
    expiresAt: invite.expiresAt ? invite.expiresAt.toISOString() : null,
    revokedAt: invite.revokedAt ? invite.revokedAt.toISOString() : null,
    createdAt: invite.createdAt.toISOString(),
    createdByUserId: invite.createdByUserId,
  });
}
