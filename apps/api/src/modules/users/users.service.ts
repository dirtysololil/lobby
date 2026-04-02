import { Injectable, NotFoundException } from '@nestjs/common';
import { type UpdateProfileInput, type UserSearchResult } from '@lobby/shared';
import { PresenceStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { publicUserSelect, toPublicUser } from '../auth/auth.mapper';
import type { RequestMetadata } from '../../common/interfaces/request-metadata.interface';
import { RelationshipsService } from '../relationships/relationships.service';

type UserClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class UsersService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly relationshipsService: RelationshipsService,
  ) {}

  public async getViewer(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: publicUserSelect,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return toPublicUser(user);
  }

  public async updateProfile(
    userId: string,
    input: UpdateProfileInput,
    requestMetadata: RequestMetadata,
  ) {
    const user = await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        profile: {
          update: {
            displayName: input.displayName.trim(),
            bio: input.bio?.trim() || null,
            presence: input.presence,
          },
        },
      },
      select: publicUserSelect,
    });

    await this.auditService.write({
      action: 'users.profile.update',
      entityType: 'Profile',
      entityId: userId,
      actorUserId: userId,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      metadata: {
        presence: input.presence,
      },
    });

    return toPublicUser(user);
  }

  public async searchUsers(
    viewerId: string,
    rawQuery: string,
  ): Promise<UserSearchResult[]> {
    const query = rawQuery.trim().toLowerCase();
    const users = await this.prisma.user.findMany({
      where: {
        id: {
          not: viewerId,
        },
        OR: [
          {
            username: query,
          },
          {
            username: {
              startsWith: query,
            },
          },
        ],
      },
      select: publicUserSelect,
      take: 20,
      orderBy: {
        username: 'asc',
      },
    });

    const items = await Promise.all(
      users.map(async (user) => ({
        user: toPublicUser(user),
        relationship: await this.relationshipsService.getRelationshipSummary(
          viewerId,
          user.id,
        ),
      })),
    );

    return items.sort((left, right) => {
      const leftExact = left.user.username === query ? 0 : 1;
      const rightExact = right.user.username === query ? 0 : 1;

      if (leftExact !== rightExact) {
        return leftExact - rightExact;
      }

      return left.user.username.localeCompare(right.user.username);
    });
  }

  public async setPresence(
    userId: string,
    presence: PresenceStatus,
    client?: UserClient,
  ): Promise<void> {
    const target = client ?? this.prisma;

    await target.profile.update({
      where: {
        userId,
      },
      data: {
        presence,
      },
    });
  }

  public async setOfflineIfNoActiveSessions(
    userId: string,
    client?: UserClient,
  ): Promise<void> {
    const target = client ?? this.prisma;
    const activeSessionsCount = await target.session.count({
      where: {
        userId,
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (activeSessionsCount === 0) {
      await this.setPresence(userId, PresenceStatus.OFFLINE, target);
    }
  }
}
