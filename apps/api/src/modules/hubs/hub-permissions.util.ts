import type { HubMemberRole } from '@prisma/client';

const roleRankMap: Record<HubMemberRole, number> = {
  MEMBER: 1,
  MODERATOR: 2,
  ADMIN: 3,
  OWNER: 4,
};

export function getHubRoleRank(role: HubMemberRole): number {
  return roleRankMap[role];
}

export function canCreateLobby(role: HubMemberRole | null): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}

export function canInviteMembers(role: HubMemberRole | null): boolean {
  return role === 'OWNER' || role === 'ADMIN' || role === 'MODERATOR';
}

export function canManageMembers(role: HubMemberRole | null): boolean {
  return role === 'OWNER' || role === 'ADMIN' || role === 'MODERATOR';
}

export function canModerateForum(role: HubMemberRole | null): boolean {
  return role === 'OWNER' || role === 'ADMIN' || role === 'MODERATOR';
}

export function canManageHub(role: HubMemberRole | null): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}

export function canManageTargetRole(
  actorRole: HubMemberRole,
  targetRole: HubMemberRole,
): boolean {
  return getHubRoleRank(actorRole) > getHubRoleRank(targetRole);
}

export function canAssignRole(
  actorRole: HubMemberRole,
  targetRole: Exclude<HubMemberRole, 'OWNER'>,
): boolean {
  if (actorRole === 'OWNER') {
    return true;
  }

  if (actorRole === 'ADMIN') {
    return targetRole === 'MODERATOR' || targetRole === 'MEMBER';
  }

  return false;
}
