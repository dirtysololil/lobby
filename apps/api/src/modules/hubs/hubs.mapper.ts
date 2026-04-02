import {
  hubBanSchema,
  hubInviteSchema,
  hubMemberSchema,
  hubPermissionSchema,
  hubSummarySchema,
  lobbySummarySchema,
  type HubBan,
  type HubInvite,
  type HubMember,
  type HubPermission,
  type HubSummary,
  type LobbySummary,
} from '@lobby/shared';
import type {
  Hub,
  HubBan as PrismaHubBan,
  HubInvite as PrismaHubInvite,
  HubMember as PrismaHubMember,
  Lobby,
} from '@prisma/client';
import { toPublicUser, type PublicUserRecord } from '../auth/auth.mapper';
import {
  canCreateLobby,
  canInviteMembers,
  canManageHub,
  canManageMembers,
  canManageTargetRole,
  canModerateForum,
} from './hub-permissions.util';

export function toHubPermission(
  role: PrismaHubMember['role'] | null,
): HubPermission {
  return hubPermissionSchema.parse({
    canCreateLobby: canCreateLobby(role),
    canInviteMembers: canInviteMembers(role),
    canManageMembers: canManageMembers(role),
    canModerateForum: canModerateForum(role),
    canManageHub: canManageHub(role),
  });
}

export function toHubSummary(
  hub: Pick<
    Hub,
    'id' | 'slug' | 'name' | 'description' | 'isPrivate' | 'createdAt'
  >,
  membershipRole: PrismaHubMember['role'] | null,
): HubSummary {
  return hubSummarySchema.parse({
    id: hub.id,
    slug: hub.slug,
    name: hub.name,
    description: hub.description,
    isPrivate: hub.isPrivate,
    createdAt: hub.createdAt.toISOString(),
    membershipRole,
  });
}

export function toLobbySummary(
  lobby: Pick<
    Lobby,
    'id' | 'hubId' | 'name' | 'description' | 'type' | 'isPrivate' | 'createdAt'
  >,
  canAccess: boolean,
  notificationSetting: string,
): LobbySummary {
  return lobbySummarySchema.parse({
    id: lobby.id,
    hubId: lobby.hubId,
    name: lobby.name,
    description: lobby.description,
    type: lobby.type,
    isPrivate: lobby.isPrivate,
    createdAt: lobby.createdAt.toISOString(),
    canAccess,
    notificationSetting,
  });
}

export function toHubMember(
  member: PrismaHubMember,
  user: PublicUserRecord,
  viewerRole: PrismaHubMember['role'] | null,
): HubMember {
  return hubMemberSchema.parse({
    id: member.id,
    role: member.role,
    joinedAt: member.createdAt.toISOString(),
    notificationSetting: member.notificationSetting,
    user: toPublicUser(user),
    canManage:
      Boolean(viewerRole) &&
      viewerRole !== null &&
      canManageMembers(viewerRole) &&
      canManageTargetRole(viewerRole, member.role),
  });
}

export function toHubInvite(
  invite: Pick<
    PrismaHubInvite,
    'id' | 'hubId' | 'status' | 'expiresAt' | 'respondedAt' | 'createdAt'
  > & {
    hub: Pick<
      Hub,
      'id' | 'slug' | 'name' | 'description' | 'isPrivate' | 'createdAt'
    >;
  },
  invitee: PublicUserRecord,
  invitedBy: PublicUserRecord,
): HubInvite {
  return hubInviteSchema.parse({
    id: invite.id,
    hubId: invite.hubId,
    status: invite.status,
    expiresAt: invite.expiresAt ? invite.expiresAt.toISOString() : null,
    respondedAt: invite.respondedAt ? invite.respondedAt.toISOString() : null,
    createdAt: invite.createdAt.toISOString(),
    hub: toHubSummary(invite.hub, null),
    invitee: toPublicUser(invitee),
    invitedBy: toPublicUser(invitedBy),
  });
}

export function toHubBan(
  ban: Pick<PrismaHubBan, 'id' | 'reason' | 'createdAt'>,
  user: PublicUserRecord,
): HubBan {
  return hubBanSchema.parse({
    id: ban.id,
    user: toPublicUser(user),
    reason: ban.reason,
    createdAt: ban.createdAt.toISOString(),
  });
}
