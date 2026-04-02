import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreateHubBanInput,
  CreateHubInput,
  CreateHubInviteInput,
  CreateHubMuteInput,
  CreateLobbyInput,
  HubShell,
  HubSummary,
  LobbySummary,
  PublicUser,
  UpdateHubMemberRoleInput,
  UserTargetActionInput,
} from '@lobby/shared';
import { HubInviteStatus, HubMemberRole, Prisma } from '@prisma/client';
import type { RequestMetadata } from '../../common/interfaces/request-metadata.interface';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { publicUserSelect, toPublicUser } from '../auth/auth.mapper';
import { RelationshipsService } from '../relationships/relationships.service';
import {
  toHubBan,
  toHubInvite,
  toHubMember,
  toHubPermission,
  toHubSummary,
  toLobbySummary,
} from './hubs.mapper';
import {
  canAssignRole,
  canCreateLobby,
  canInviteMembers,
  canManageMembers,
  canManageTargetRole,
  canModerateForum,
  getHubRoleRank,
} from './hub-permissions.util';

const hubMemberWithUserInclude = {
  user: {
    select: publicUserSelect,
  },
} satisfies Prisma.HubMemberInclude;

const hubInviteInclude = {
  inviteeUser: {
    select: publicUserSelect,
  },
  invitedByUser: {
    select: publicUserSelect,
  },
  hub: {
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      isPrivate: true,
      createdAt: true,
    },
  },
} satisfies Prisma.HubInviteInclude;

type HubInviteRecord = Prisma.HubInviteGetPayload<{
  include: typeof hubInviteInclude;
}>;

type AccessibleLobbyRecord = Prisma.LobbyGetPayload<{
  include: {
    accessMembers: {
      select: {
        userId: true;
      };
    };
    hub: {
      include: {
        members: {
          where: {
            userId: string;
          };
        };
      };
    };
  };
}>;

type ForumPostingContext = {
  hubRole: HubMemberRole;
};

@Injectable()
export class HubsService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly relationshipsService: RelationshipsService,
  ) {}

  public async listViewerHubs(viewerId: string): Promise<HubSummary[]> {
    const memberships = await this.prisma.hubMember.findMany({
      where: {
        userId: viewerId,
      },
      include: {
        hub: {
          select: {
            id: true,
            slug: true,
            name: true,
            description: true,
            isPrivate: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return memberships.map((membership) =>
      toHubSummary(membership.hub, membership.role),
    );
  }

  public async listViewerPendingInvites(viewerId: string) {
    const now = new Date();
    const invites = await this.prisma.hubInvite.findMany({
      where: {
        inviteeUserId: viewerId,
        status: HubInviteStatus.PENDING,
        OR: [
          {
            expiresAt: null,
          },
          {
            expiresAt: {
              gt: now,
            },
          },
        ],
      },
      include: hubInviteInclude,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return invites.map((invite) => this.toViewerInvite(invite));
  }

  public async createHub(
    actor: PublicUser,
    input: CreateHubInput,
    requestMetadata: RequestMetadata,
  ): Promise<HubSummary> {
    const hub = await this.prisma.$transaction(async (transaction) => {
      const createdHub = await transaction.hub.create({
        data: {
          name: input.name.trim(),
          slug: input.slug.trim().toLowerCase(),
          description: input.description?.trim() || null,
          isPrivate: input.isPrivate,
          createdByUserId: actor.id,
        },
      });

      await transaction.hubMember.create({
        data: {
          hubId: createdHub.id,
          userId: actor.id,
          role: HubMemberRole.OWNER,
        },
      });

      return createdHub;
    });

    await this.auditService.write({
      action: 'hubs.create',
      entityType: 'Hub',
      entityId: hub.id,
      actorUserId: actor.id,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      metadata: {
        slug: hub.slug,
        isPrivate: hub.isPrivate,
      },
    });

    return toHubSummary(hub, HubMemberRole.OWNER);
  }

  public async getHubShell(viewerId: string, hubId: string): Promise<HubShell> {
    const hub = await this.prisma.hub.findUnique({
      where: {
        id: hubId,
      },
      include: {
        members: {
          include: hubMemberWithUserInclude,
          orderBy: [
            {
              role: 'asc',
            },
            {
              createdAt: 'asc',
            },
          ],
        },
        lobbies: {
          include: {
            accessMembers: {
              select: {
                userId: true,
              },
            },
          },
          orderBy: [
            {
              type: 'asc',
            },
            {
              createdAt: 'asc',
            },
          ],
        },
        invites: {
          include: hubInviteInclude,
          orderBy: {
            createdAt: 'desc',
          },
        },
        bans: {
          include: {
            user: {
              select: publicUserSelect,
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        mutes: {
          include: {
            user: {
              select: publicUserSelect,
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!hub) {
      throw new NotFoundException('Hub not found');
    }

    const viewerMembership =
      hub.members.find((member) => member.userId === viewerId) ?? null;

    if (hub.isPrivate && !viewerMembership) {
      throw new ForbiddenException('Private hub access denied');
    }

    const viewerRole = viewerMembership?.role ?? null;
    const permissions = toHubPermission(viewerRole);
    const isViewerMuted = Boolean(
      viewerMembership &&
      hub.mutes.find(
        (mute) =>
          mute.userId === viewerId &&
          (!mute.expiresAt || mute.expiresAt > new Date()),
      ),
    );

    const lobbies = hub.lobbies
      .map((lobby) =>
        toLobbySummary(
          lobby,
          this.canAccessLobby(
            viewerId,
            viewerRole,
            lobby.createdByUserId,
            lobby.isPrivate,
            lobby.accessMembers,
          ),
        ),
      )
      .filter((lobby) => lobby.canAccess);

    const members = viewerMembership
      ? hub.members.map((member) =>
          toHubMember(member, member.user, viewerRole),
        )
      : [];

    const pendingInvites = permissions.canInviteMembers
      ? hub.invites
          .filter((invite) => invite.status === HubInviteStatus.PENDING)
          .map((invite) => this.toViewerInvite(invite))
      : [];

    const activeBans = permissions.canManageMembers
      ? hub.bans.map((ban) => toHubBan(ban, ban.user))
      : [];

    const activeMutes = permissions.canManageMembers
      ? hub.mutes
          .filter((mute) => !mute.expiresAt || mute.expiresAt > new Date())
          .map((mute) => ({
            id: mute.id,
            user: toPublicUser(mute.user),
            expiresAt: mute.expiresAt ? mute.expiresAt.toISOString() : null,
            createdAt: mute.createdAt.toISOString(),
          }))
      : [];

    return {
      hub: {
        id: hub.id,
        slug: hub.slug,
        name: hub.name,
        description: hub.description,
        isPrivate: hub.isPrivate,
        createdAt: hub.createdAt.toISOString(),
        membershipRole: viewerRole,
        isViewerMuted,
        permissions,
        lobbies,
        members,
        pendingInvites,
        activeMutes,
        activeBans,
      },
    };
  }

  public async createLobby(
    actor: PublicUser,
    hubId: string,
    input: CreateLobbyInput,
    requestMetadata: RequestMetadata,
  ): Promise<LobbySummary> {
    const membership = await this.assertHubMemberRole(actor.id, hubId);

    if (!canCreateLobby(membership.role)) {
      throw new ForbiddenException(
        'Insufficient permissions to create lobbies',
      );
    }

    const allowedMembers = input.isPrivate
      ? await this.resolveHubMemberUsers(hubId, input.allowedUsernames)
      : [];

    const lobby = await this.prisma.lobby.create({
      data: {
        hubId,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        type: input.type,
        isPrivate: input.isPrivate,
        createdByUserId: actor.id,
        accessMembers: input.isPrivate
          ? {
              create: allowedMembers.map((member) => ({
                userId: member.id,
                grantedByUserId: actor.id,
              })),
            }
          : undefined,
      },
      include: {
        accessMembers: {
          select: {
            userId: true,
          },
        },
      },
    });

    await this.auditService.write({
      action: 'hubs.lobby.create',
      entityType: 'Lobby',
      entityId: lobby.id,
      actorUserId: actor.id,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      metadata: {
        hubId,
        type: lobby.type,
        isPrivate: lobby.isPrivate,
      },
    });

    return toLobbySummary(lobby, true);
  }

  public async updatePrivateLobbyAccess(
    actor: PublicUser,
    hubId: string,
    lobbyId: string,
    usernames: string[],
    requestMetadata: RequestMetadata,
  ): Promise<LobbySummary> {
    const membership = await this.assertHubMemberRole(actor.id, hubId);

    if (!canCreateLobby(membership.role)) {
      throw new ForbiddenException(
        'Insufficient permissions to manage lobby access',
      );
    }

    const lobby = await this.prisma.lobby.findFirst({
      where: {
        id: lobbyId,
        hubId,
      },
      include: {
        accessMembers: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (!lobby) {
      throw new NotFoundException('Lobby not found');
    }

    if (!lobby.isPrivate) {
      throw new ConflictException('Lobby is not private');
    }

    const allowedMembers = await this.resolveHubMemberUsers(hubId, usernames);

    await this.prisma.$transaction([
      this.prisma.lobbyAccess.deleteMany({
        where: {
          lobbyId,
        },
      }),
      this.prisma.lobbyAccess.createMany({
        data: allowedMembers.map((member) => ({
          lobbyId,
          userId: member.id,
          grantedByUserId: actor.id,
        })),
        skipDuplicates: true,
      }),
    ]);

    await this.auditService.write({
      action: 'hubs.lobby.access.update',
      entityType: 'Lobby',
      entityId: lobbyId,
      actorUserId: actor.id,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      metadata: {
        hubId,
        allowedUsernames: allowedMembers.map((member) => member.username),
      },
    });

    return toLobbySummary(lobby, true);
  }

  public async createHubInvite(
    actor: PublicUser,
    hubId: string,
    input: CreateHubInviteInput,
    requestMetadata: RequestMetadata,
  ) {
    const membership = await this.assertHubMemberRole(actor.id, hubId);

    if (!canInviteMembers(membership.role)) {
      throw new ForbiddenException(
        'Insufficient permissions to invite members',
      );
    }

    const targetUser = await this.getUserByUsernameOrThrow(input.username);

    if (targetUser.id === actor.id) {
      throw new ConflictException('You are already in this hub');
    }

    await this.relationshipsService.assertInteractionAllowed(
      actor.id,
      targetUser.id,
    );
    await this.assertUserNotBanned(hubId, targetUser.id);

    const existingMembership = await this.prisma.hubMember.findUnique({
      where: {
        hubId_userId: {
          hubId,
          userId: targetUser.id,
        },
      },
      select: {
        id: true,
      },
    });

    if (existingMembership) {
      throw new ConflictException('User is already a hub member');
    }

    const invite = await this.prisma.hubInvite.upsert({
      where: {
        hubId_inviteeUserId: {
          hubId,
          inviteeUserId: targetUser.id,
        },
      },
      create: {
        hubId,
        inviteeUserId: targetUser.id,
        invitedByUserId: actor.id,
        status: HubInviteStatus.PENDING,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      },
      update: {
        invitedByUserId: actor.id,
        status: HubInviteStatus.PENDING,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        respondedAt: null,
      },
      include: hubInviteInclude,
    });

    await this.auditService.write({
      action: 'hubs.invite.create',
      entityType: 'HubInvite',
      entityId: invite.id,
      actorUserId: actor.id,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      metadata: {
        hubId,
        inviteeUserId: targetUser.id,
      },
    });

    return this.toViewerInvite(invite);
  }

  public async acceptHubInvite(
    actor: PublicUser,
    inviteId: string,
    requestMetadata: RequestMetadata,
  ): Promise<void> {
    const invite = await this.getPendingInviteOrThrow(inviteId);

    if (invite.inviteeUserId !== actor.id) {
      throw new ForbiddenException('Invite access denied');
    }

    await this.assertUserNotBanned(invite.hubId, actor.id);

    await this.prisma.$transaction(async (transaction) => {
      await transaction.hubMember.upsert({
        where: {
          hubId_userId: {
            hubId: invite.hubId,
            userId: actor.id,
          },
        },
        create: {
          hubId: invite.hubId,
          userId: actor.id,
          role: HubMemberRole.MEMBER,
        },
        update: {},
      });

      await transaction.hubInvite.update({
        where: {
          id: inviteId,
        },
        data: {
          status: HubInviteStatus.ACCEPTED,
          respondedAt: new Date(),
        },
      });
    });

    await this.auditService.write({
      action: 'hubs.invite.accept',
      entityType: 'HubInvite',
      entityId: inviteId,
      actorUserId: actor.id,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      metadata: {
        hubId: invite.hubId,
      },
    });
  }

  public async declineHubInvite(
    actor: PublicUser,
    inviteId: string,
    requestMetadata: RequestMetadata,
  ): Promise<void> {
    const invite = await this.getPendingInviteOrThrow(inviteId);

    if (invite.inviteeUserId !== actor.id) {
      throw new ForbiddenException('Invite access denied');
    }

    await this.prisma.hubInvite.update({
      where: {
        id: inviteId,
      },
      data: {
        status: HubInviteStatus.DECLINED,
        respondedAt: new Date(),
      },
    });

    await this.auditService.write({
      action: 'hubs.invite.decline',
      entityType: 'HubInvite',
      entityId: inviteId,
      actorUserId: actor.id,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      metadata: {
        hubId: invite.hubId,
      },
    });
  }

  public async updateMemberRole(
    actor: PublicUser,
    hubId: string,
    input: UpdateHubMemberRoleInput,
    requestMetadata: RequestMetadata,
  ): Promise<void> {
    const actorMembership = await this.assertHubMemberRole(actor.id, hubId);
    const targetMembership = await this.getHubMemberByUsernameOrThrow(
      hubId,
      input.username,
    );

    if (targetMembership.userId === actor.id) {
      throw new ConflictException('You cannot change your own hub role');
    }

    if (!canAssignRole(actorMembership.role, input.role)) {
      throw new ForbiddenException(
        'Insufficient permissions to assign this role',
      );
    }

    if (!canManageTargetRole(actorMembership.role, targetMembership.role)) {
      throw new ForbiddenException(
        'Insufficient permissions to manage this member',
      );
    }

    await this.prisma.hubMember.update({
      where: {
        id: targetMembership.id,
      },
      data: {
        role: input.role,
      },
    });

    await this.auditService.write({
      action: 'hubs.member.role.update',
      entityType: 'HubMember',
      entityId: targetMembership.id,
      actorUserId: actor.id,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      metadata: {
        hubId,
        targetUserId: targetMembership.userId,
        role: input.role,
      },
    });
  }

  public async kickMember(
    actor: PublicUser,
    hubId: string,
    input: UserTargetActionInput,
    requestMetadata: RequestMetadata,
  ): Promise<void> {
    const actorMembership = await this.assertHubMemberRole(actor.id, hubId);
    const targetMembership = await this.getHubMemberByUsernameOrThrow(
      hubId,
      input.username,
    );

    if (!canManageMembers(actorMembership.role)) {
      throw new ForbiddenException('Insufficient permissions to kick members');
    }

    if (!canManageTargetRole(actorMembership.role, targetMembership.role)) {
      throw new ForbiddenException(
        'Insufficient permissions to kick this member',
      );
    }

    await this.removeMemberFromHub(hubId, targetMembership.userId);

    await this.auditService.write({
      action: 'hubs.member.kick',
      entityType: 'HubMember',
      entityId: targetMembership.id,
      actorUserId: actor.id,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      metadata: {
        hubId,
        targetUserId: targetMembership.userId,
      },
    });
  }

  public async banMember(
    actor: PublicUser,
    hubId: string,
    input: CreateHubBanInput,
    requestMetadata: RequestMetadata,
  ): Promise<void> {
    const actorMembership = await this.assertHubMemberRole(actor.id, hubId);

    if (!canManageMembers(actorMembership.role)) {
      throw new ForbiddenException('Insufficient permissions to ban members');
    }

    const targetUser = await this.getUserByUsernameOrThrow(input.username);
    const targetMembership = await this.prisma.hubMember.findUnique({
      where: {
        hubId_userId: {
          hubId,
          userId: targetUser.id,
        },
      },
    });

    if (
      targetMembership &&
      !canManageTargetRole(actorMembership.role, targetMembership.role)
    ) {
      throw new ForbiddenException(
        'Insufficient permissions to ban this member',
      );
    }

    await this.prisma.$transaction(async (transaction) => {
      await transaction.hubBan.upsert({
        where: {
          hubId_userId: {
            hubId,
            userId: targetUser.id,
          },
        },
        create: {
          hubId,
          userId: targetUser.id,
          bannedByUserId: actor.id,
          reason: input.reason?.trim() || null,
        },
        update: {
          bannedByUserId: actor.id,
          reason: input.reason?.trim() || null,
        },
      });

      await transaction.hubInvite.updateMany({
        where: {
          hubId,
          inviteeUserId: targetUser.id,
          status: HubInviteStatus.PENDING,
        },
        data: {
          status: HubInviteStatus.REVOKED,
          respondedAt: new Date(),
        },
      });

      await transaction.hubMute.deleteMany({
        where: {
          hubId,
          userId: targetUser.id,
        },
      });

      await transaction.hubMember.deleteMany({
        where: {
          hubId,
          userId: targetUser.id,
        },
      });

      await transaction.lobbyAccess.deleteMany({
        where: {
          userId: targetUser.id,
          lobby: {
            hubId,
          },
        },
      });
    });

    await this.auditService.write({
      action: 'hubs.member.ban',
      entityType: 'HubBan',
      actorUserId: actor.id,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      metadata: {
        hubId,
        targetUserId: targetUser.id,
        reason: input.reason?.trim() || null,
      },
    });
  }

  public async unbanMember(
    actor: PublicUser,
    hubId: string,
    input: UserTargetActionInput,
    requestMetadata: RequestMetadata,
  ): Promise<void> {
    const actorMembership = await this.assertHubMemberRole(actor.id, hubId);

    if (!canManageMembers(actorMembership.role)) {
      throw new ForbiddenException('Insufficient permissions to unban members');
    }

    const targetUser = await this.getUserByUsernameOrThrow(input.username);
    const ban = await this.prisma.hubBan.findUnique({
      where: {
        hubId_userId: {
          hubId,
          userId: targetUser.id,
        },
      },
    });

    if (!ban) {
      throw new NotFoundException('Hub ban not found');
    }

    await this.prisma.hubBan.delete({
      where: {
        id: ban.id,
      },
    });

    await this.auditService.write({
      action: 'hubs.member.unban',
      entityType: 'HubBan',
      entityId: ban.id,
      actorUserId: actor.id,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      metadata: {
        hubId,
        targetUserId: targetUser.id,
      },
    });
  }

  public async muteMember(
    actor: PublicUser,
    hubId: string,
    input: CreateHubMuteInput,
    requestMetadata: RequestMetadata,
  ): Promise<void> {
    const actorMembership = await this.assertHubMemberRole(actor.id, hubId);

    if (!canManageMembers(actorMembership.role)) {
      throw new ForbiddenException('Insufficient permissions to mute members');
    }

    const targetMembership = await this.getHubMemberByUsernameOrThrow(
      hubId,
      input.username,
    );

    if (!canManageTargetRole(actorMembership.role, targetMembership.role)) {
      throw new ForbiddenException(
        'Insufficient permissions to mute this member',
      );
    }

    const mute = await this.prisma.hubMute.upsert({
      where: {
        hubId_userId: {
          hubId,
          userId: targetMembership.userId,
        },
      },
      create: {
        hubId,
        userId: targetMembership.userId,
        mutedByUserId: actor.id,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      },
      update: {
        mutedByUserId: actor.id,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      },
    });

    await this.auditService.write({
      action: 'hubs.member.mute',
      entityType: 'HubMute',
      entityId: mute.id,
      actorUserId: actor.id,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      metadata: {
        hubId,
        targetUserId: targetMembership.userId,
        expiresAt: input.expiresAt ?? null,
      },
    });
  }

  public async unmuteMember(
    actor: PublicUser,
    hubId: string,
    input: UserTargetActionInput,
    requestMetadata: RequestMetadata,
  ): Promise<void> {
    const actorMembership = await this.assertHubMemberRole(actor.id, hubId);

    if (!canManageMembers(actorMembership.role)) {
      throw new ForbiddenException(
        'Insufficient permissions to unmute members',
      );
    }

    const targetUser = await this.getUserByUsernameOrThrow(input.username);
    const mute = await this.prisma.hubMute.findUnique({
      where: {
        hubId_userId: {
          hubId,
          userId: targetUser.id,
        },
      },
    });

    if (!mute) {
      throw new NotFoundException('Hub mute not found');
    }

    await this.prisma.hubMute.delete({
      where: {
        id: mute.id,
      },
    });

    await this.auditService.write({
      action: 'hubs.member.unmute',
      entityType: 'HubMute',
      entityId: mute.id,
      actorUserId: actor.id,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      metadata: {
        hubId,
        targetUserId: targetUser.id,
      },
    });
  }

  public async getAccessibleLobbyOrThrow(
    viewerId: string,
    hubId: string,
    lobbyId: string,
  ): Promise<AccessibleLobbyRecord> {
    const lobby = await this.prisma.lobby.findFirst({
      where: {
        id: lobbyId,
        hubId,
      },
      include: {
        accessMembers: {
          select: {
            userId: true,
          },
        },
        hub: {
          include: {
            members: {
              where: {
                userId: viewerId,
              },
            },
          },
        },
      },
    });

    if (!lobby) {
      throw new NotFoundException('Lobby not found');
    }

    const membership = lobby.hub.members[0] ?? null;

    if (lobby.hub.isPrivate && !membership) {
      throw new ForbiddenException('Private hub access denied');
    }

    const canAccess = this.canAccessLobby(
      viewerId,
      membership?.role ?? null,
      lobby.createdByUserId,
      lobby.isPrivate,
      lobby.accessMembers,
    );

    if (!canAccess) {
      throw new ForbiddenException('Private lobby access denied');
    }

    return lobby;
  }

  public async assertCanModerateForum(
    viewerId: string,
    hubId: string,
  ): Promise<HubMemberRole> {
    const membership = await this.assertHubMemberRole(viewerId, hubId);

    if (!canModerateForum(membership.role)) {
      throw new ForbiddenException(
        'Insufficient permissions to moderate forum',
      );
    }

    return membership.role;
  }

  public async assertCanCreateForumContent(
    viewerId: string,
    hubId: string,
    lobbyId: string,
  ): Promise<ForumPostingContext> {
    const membership = await this.assertHubMemberRole(viewerId, hubId);
    await this.getAccessibleLobbyOrThrow(viewerId, hubId, lobbyId);
    await this.assertNotMuted(hubId, viewerId);

    return {
      hubRole: membership.role,
    };
  }

  private async assertHubMemberRole(viewerId: string, hubId: string) {
    const membership = await this.prisma.hubMember.findUnique({
      where: {
        hubId_userId: {
          hubId,
          userId: viewerId,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('Hub membership is required');
    }

    return membership;
  }

  private async getHubMemberByUsernameOrThrow(hubId: string, username: string) {
    const targetUser = await this.getUserByUsernameOrThrow(username);
    const membership = await this.prisma.hubMember.findUnique({
      where: {
        hubId_userId: {
          hubId,
          userId: targetUser.id,
        },
      },
    });

    if (!membership) {
      throw new NotFoundException('Hub member not found');
    }

    return membership;
  }

  private async getUserByUsernameOrThrow(username: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        username: username.trim().toLowerCase(),
      },
      select: publicUserSelect,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  private async resolveHubMemberUsers(hubId: string, usernames: string[]) {
    const uniqueUsernames = [
      ...new Set(usernames.map((username) => username.trim().toLowerCase())),
    ];

    if (uniqueUsernames.length === 0) {
      return [];
    }

    const members = await this.prisma.hubMember.findMany({
      where: {
        hubId,
        user: {
          username: {
            in: uniqueUsernames,
          },
        },
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    if (members.length !== uniqueUsernames.length) {
      throw new NotFoundException(
        'One or more private lobby members were not found in this hub',
      );
    }

    return members.map((member) => member.user);
  }

  private canAccessLobby(
    viewerId: string,
    viewerRole: HubMemberRole | null,
    createdByUserId: string,
    isPrivate: boolean,
    accessMembers: Array<{ userId: string }>,
  ): boolean {
    if (!isPrivate) {
      return true;
    }

    if (!viewerRole) {
      return false;
    }

    if (getHubRoleRank(viewerRole) >= getHubRoleRank(HubMemberRole.MODERATOR)) {
      return true;
    }

    if (createdByUserId === viewerId) {
      return true;
    }

    return accessMembers.some((member) => member.userId === viewerId);
  }

  private async removeMemberFromHub(
    hubId: string,
    userId: string,
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.hubMember.deleteMany({
        where: {
          hubId,
          userId,
        },
      }),
      this.prisma.hubMute.deleteMany({
        where: {
          hubId,
          userId,
        },
      }),
      this.prisma.lobbyAccess.deleteMany({
        where: {
          userId,
          lobby: {
            hubId,
          },
        },
      }),
    ]);
  }

  private async assertUserNotBanned(
    hubId: string,
    userId: string,
  ): Promise<void> {
    const ban = await this.prisma.hubBan.findUnique({
      where: {
        hubId_userId: {
          hubId,
          userId,
        },
      },
      select: {
        id: true,
      },
    });

    if (ban) {
      throw new ForbiddenException('User is banned from this hub');
    }
  }

  private async assertNotMuted(hubId: string, userId: string): Promise<void> {
    const mute = await this.prisma.hubMute.findUnique({
      where: {
        hubId_userId: {
          hubId,
          userId,
        },
      },
    });

    if (!mute) {
      return;
    }

    if (!mute.expiresAt || mute.expiresAt > new Date()) {
      throw new ForbiddenException('You are muted in this hub');
    }

    await this.prisma.hubMute.delete({
      where: {
        id: mute.id,
      },
    });
  }

  private async getPendingInviteOrThrow(
    inviteId: string,
  ): Promise<HubInviteRecord> {
    const invite = await this.prisma.hubInvite.findUnique({
      where: {
        id: inviteId,
      },
      include: hubInviteInclude,
    });

    if (!invite) {
      throw new NotFoundException('Hub invite not found');
    }

    if (invite.status !== HubInviteStatus.PENDING) {
      throw new ConflictException('Hub invite is not active');
    }

    if (invite.expiresAt && invite.expiresAt <= new Date()) {
      throw new ConflictException('Hub invite has expired');
    }

    return invite;
  }

  private toViewerInvite(invite: HubInviteRecord) {
    return {
      ...toHubInvite(invite, invite.inviteeUser, invite.invitedByUser),
      hub: toHubSummary(invite.hub, null),
    };
  }
}
