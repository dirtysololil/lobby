import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AdminOverview,
  AdminUserSummary,
  ListAdminAuditQuery,
  ListAdminUsersQuery,
  PlatformBlock,
  PublicUser,
  UpdateAdminUserRoleInput,
  UpsertPlatformBlockInput,
} from '@lobby/shared';
import { Prisma, UserRole } from '@prisma/client';
import type { RequestMetadata } from '../../common/interfaces/request-metadata.interface';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { toPublicUser, publicUserSelect } from '../auth/auth.mapper';
import { InvitesService } from '../invites/invites.service';
import { UsersService } from '../users/users.service';

const userAdminInclude = {
  profile: {
    select: publicUserSelect.profile.select,
  },
  platformBlock: {
    include: {
      blockedByUser: {
        select: publicUserSelect,
      },
    },
  },
} satisfies Prisma.UserInclude;

type AdminUserRecord = Prisma.UserGetPayload<{
  include: typeof userAdminInclude;
}>;

@Injectable()
export class AdminService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly invitesService: InvitesService,
    private readonly usersService: UsersService,
  ) {}

  public async getOverview(): Promise<AdminOverview> {
    const [users, blockedUsers, invites, hubs, auditEvents, recentInvites] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.platformBlock.count(),
        this.prisma.inviteKey.count(),
        this.prisma.hub.count(),
        this.prisma.auditLog.count(),
        this.invitesService.listInvites(),
      ]);

    return {
      counts: {
        users,
        blockedUsers,
        invites,
        hubs,
        auditEvents,
      },
      recentInvites: recentInvites.slice(0, 5),
    };
  }

  public async listUsers(input: ListAdminUsersQuery) {
    const where: Prisma.UserWhereInput = {
      ...(input.query
        ? {
            OR: [
              {
                username: {
                  contains: input.query.toLowerCase(),
                },
              },
              {
                email: {
                  contains: input.query.toLowerCase(),
                },
              },
              {
                profile: {
                  is: {
                    displayName: {
                      contains: input.query,
                    },
                  },
                },
              },
            ],
          }
        : {}),
      ...(input.role ? { role: input.role } : {}),
      ...(input.blocked === 'blocked'
        ? {
            platformBlock: {
              isNot: null,
            },
          }
        : {}),
      ...(input.blocked === 'active'
        ? {
            platformBlock: {
              is: null,
            },
          }
        : {}),
    };
    const skip = (input.page - 1) * input.pageSize;
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: userAdminInclude,
        orderBy: [
          {
            createdAt: 'desc',
          },
        ],
        skip,
        take: input.pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);

    const items = await Promise.all(
      users.map((user) => this.toAdminUser(user)),
    );

    return {
      items,
      total,
      page: input.page,
      pageSize: input.pageSize,
    };
  }

  public async getUserDetail(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      include: userAdminInclude,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      item: await this.toAdminUser(user),
    };
  }

  public async listInvites() {
    return {
      items: await this.invitesService.listInvites(),
    };
  }

  public async listAudit(input: ListAdminAuditQuery) {
    const payload = await this.auditService.list(input);

    return {
      items: payload.items.map((item) => ({
        id: item.id,
        action: item.action,
        entityType: item.entityType,
        entityId: item.entityId,
        ipAddress: item.ipAddress,
        userAgent: item.userAgent,
        metadata: item.metadata ?? null,
        createdAt: item.createdAt.toISOString(),
        actor: item.actorUser ? toPublicUser(item.actorUser) : null,
      })),
      total: payload.total,
      page: input.page,
      pageSize: input.pageSize,
    };
  }

  public async blockUser(
    actor: PublicUser,
    userId: string,
    input: UpsertPlatformBlockInput,
    requestMetadata: RequestMetadata,
  ): Promise<PlatformBlock> {
    const targetUser = await this.getTargetUserOrThrow(userId);
    this.assertCanModerate(actor, targetUser);

    const block = await this.prisma.$transaction(async (transaction) => {
      const result = await transaction.platformBlock.upsert({
        where: {
          userId,
        },
        create: {
          userId,
          blockedByUserId: actor.id,
          reason: input.reason?.trim() || null,
        },
        update: {
          blockedByUserId: actor.id,
          reason: input.reason?.trim() || null,
        },
        include: {
          blockedByUser: {
            select: publicUserSelect,
          },
        },
      });

      await transaction.session.updateMany({
        where: {
          userId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });

      return result;
    });

    await this.usersService.setOfflineIfNoActiveSessions(userId);
    await this.auditService.write({
      action: 'admin.user.block',
      entityType: 'PlatformBlock',
      entityId: block.id,
      actorUserId: actor.id,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      metadata: {
        targetUserId: userId,
        reason: input.reason?.trim() || null,
      },
    });

    return this.toPlatformBlock(block);
  }

  public async unblockUser(
    actor: PublicUser,
    userId: string,
    requestMetadata: RequestMetadata,
  ): Promise<void> {
    const targetUser = await this.getTargetUserOrThrow(userId);
    this.assertCanModerate(actor, targetUser);

    const block = await this.prisma.platformBlock.findUnique({
      where: {
        userId,
      },
    });

    if (!block) {
      throw new NotFoundException('Platform block not found');
    }

    await this.prisma.platformBlock.delete({
      where: {
        id: block.id,
      },
    });

    await this.auditService.write({
      action: 'admin.user.unblock',
      entityType: 'PlatformBlock',
      entityId: block.id,
      actorUserId: actor.id,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      metadata: {
        targetUserId: userId,
      },
    });
  }

  public async updateUserRole(
    actor: PublicUser,
    userId: string,
    input: UpdateAdminUserRoleInput,
    requestMetadata: RequestMetadata,
  ): Promise<AdminUserSummary> {
    const targetUser = await this.getTargetUserOrThrow(userId);
    this.assertCanModerate(actor, targetUser);

    if (actor.role !== 'OWNER' && input.role === UserRole.OWNER) {
      throw new ForbiddenException(
        'Insufficient permissions to assign the owner role',
      );
    }

    const user =
      targetUser.role === input.role
        ? targetUser
        : await this.prisma.user.update({
            where: {
              id: userId,
            },
            data: {
              role: input.role,
            },
            include: userAdminInclude,
          });

    await this.auditService.write({
      action: 'admin.user.role.update',
      entityType: 'User',
      entityId: userId,
      actorUserId: actor.id,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      metadata: {
        previousRole: targetUser.role,
        nextRole: input.role,
      },
    });

    return this.toAdminUser(user);
  }

  private async toAdminUser(user: AdminUserRecord): Promise<AdminUserSummary> {
    const [activeSessionCount, hubMembershipCount, lastSeenAt] =
      await Promise.all([
        this.prisma.session.count({
          where: {
            userId: user.id,
            revokedAt: null,
            expiresAt: {
              gt: new Date(),
            },
          },
        }),
        this.prisma.hubMember.count({
          where: {
            userId: user.id,
          },
        }),
        this.prisma.session.findFirst({
          where: {
            userId: user.id,
          },
          orderBy: {
            lastActiveAt: 'desc',
          },
          select: {
            lastActiveAt: true,
          },
        }),
      ]);

    return {
      user: toPublicUser(user as unknown as Parameters<typeof toPublicUser>[0]),
      activeSessionCount,
      hubMembershipCount,
      lastSeenAt: lastSeenAt?.lastActiveAt.toISOString() ?? null,
      platformBlock: user.platformBlock
        ? this.toPlatformBlock(user.platformBlock)
        : null,
    };
  }

  private async getTargetUserOrThrow(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      include: userAdminInclude,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  private toPlatformBlock(
    block: Prisma.PlatformBlockGetPayload<{
      include: {
        blockedByUser: {
          select: typeof publicUserSelect;
        };
      };
    }>,
  ): PlatformBlock {
    return {
      id: block.id,
      reason: block.reason,
      createdAt: block.createdAt.toISOString(),
      blockedBy: toPublicUser(block.blockedByUser),
    };
  }

  private assertCanModerate(
    actor: PublicUser,
    targetUser: Pick<AdminUserRecord, 'id' | 'role'>,
  ): void {
    if (actor.id === targetUser.id) {
      throw new ConflictException('You cannot moderate your own account');
    }

    if (this.getRoleRank(actor.role) <= this.getRoleRank(targetUser.role)) {
      throw new ForbiddenException(
        'Insufficient permissions to moderate this user',
      );
    }
  }

  private getRoleRank(role: UserRole): number {
    switch (role) {
      case UserRole.OWNER:
        return 3;
      case UserRole.ADMIN:
        return 2;
      default:
        return 1;
    }
  }
}
