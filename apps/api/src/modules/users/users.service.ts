import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  NotificationSetting,
  UpdateProfileInput,
  UpdateViewerNotificationDefaultsInput,
  UserNotificationSettingsOverview,
  UserSearchResult,
} from '@lobby/shared';
import { PresenceStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { publicUserSelect, toPublicUser } from '../auth/auth.mapper';
import type { RequestMetadata } from '../../common/interfaces/request-metadata.interface';
import { RelationshipsService } from '../relationships/relationships.service';
import { EnvService } from '../env/env.service';
import { StorageService } from '../storage/storage.service';
import { parseAvatarImageMetadata } from '../storage/avatar-image.util';

type UserClient = Prisma.TransactionClient | PrismaService;
type UploadedAvatarFile = {
  buffer: Buffer;
  size: number;
  originalname: string;
};

@Injectable()
export class UsersService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly relationshipsService: RelationshipsService,
    private readonly envService: EnvService,
    private readonly storageService: StorageService,
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
            avatarPreset: input.avatarPreset,
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
        avatarPreset: input.avatarPreset,
      },
    });

    return toPublicUser(user);
  }

  public async uploadAvatar(
    userId: string,
    file: UploadedAvatarFile | undefined,
    requestMetadata: RequestMetadata,
  ) {
    if (!file || !file.buffer || file.size === 0) {
      throw new BadRequestException('Avatar file is required');
    }

    const env = this.envService.getValues();
    const maxBytes = Math.floor(env.MAX_AVATAR_MB * 1024 * 1024);

    if (file.size > maxBytes) {
      throw new BadRequestException(
        `Avatar file exceeds ${env.MAX_AVATAR_MB}MB limit`,
      );
    }

    let metadata;

    try {
      metadata = parseAvatarImageMetadata(file.buffer, {
        maxFrames: env.MAX_AVATAR_FRAMES,
        maxAnimationMs: env.MAX_AVATAR_ANIMATION_MS,
      });
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Avatar file is invalid',
      );
    }
    const existingProfile = await this.prisma.profile.findUnique({
      where: {
        userId,
      },
      select: {
        avatarFileKey: true,
      },
    });

    if (!existingProfile) {
      throw new NotFoundException('Profile not found');
    }

    const fileKey = await this.storageService.writeAvatar(
      file.buffer,
      metadata.extension,
    );

    try {
      const user = await this.prisma.user.update({
        where: {
          id: userId,
        },
        data: {
          profile: {
            update: {
              avatarFileKey: fileKey,
              avatarOriginalName: file.originalname || null,
              avatarMimeType: metadata.mimeType,
              avatarBytes: metadata.bytes,
              avatarWidth: metadata.width,
              avatarHeight: metadata.height,
              avatarFrameCount: metadata.frameCount,
              avatarAnimationDurationMs: metadata.animationDurationMs,
              avatarIsAnimated: metadata.isAnimated,
            },
          },
        },
        select: publicUserSelect,
      });

      await this.storageService.deleteObject(existingProfile.avatarFileKey);
      await this.auditService.write({
        action: 'users.avatar.upload',
        entityType: 'Profile',
        entityId: userId,
        actorUserId: userId,
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
        metadata: {
          mimeType: metadata.mimeType,
          bytes: metadata.bytes,
          isAnimated: metadata.isAnimated,
        },
      });

      return toPublicUser(user);
    } catch (error) {
      await this.storageService.deleteObject(fileKey);
      throw error;
    }
  }

  public async removeAvatar(userId: string, requestMetadata: RequestMetadata) {
    const profile = await this.prisma.profile.findUnique({
      where: {
        userId,
      },
      select: {
        avatarFileKey: true,
      },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    const user = await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        profile: {
          update: {
            avatarFileKey: null,
            avatarOriginalName: null,
            avatarMimeType: null,
            avatarBytes: null,
            avatarWidth: null,
            avatarHeight: null,
            avatarFrameCount: null,
            avatarAnimationDurationMs: null,
            avatarIsAnimated: false,
          },
        },
      },
      select: publicUserSelect,
    });

    await this.storageService.deleteObject(profile.avatarFileKey);
    await this.auditService.write({
      action: 'users.avatar.remove',
      entityType: 'Profile',
      entityId: userId,
      actorUserId: userId,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
    });

    return toPublicUser(user);
  }

  public async getAvatarAsset(userId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: {
        userId,
      },
      select: {
        avatarFileKey: true,
        avatarMimeType: true,
      },
    });

    if (!profile?.avatarFileKey || !profile.avatarMimeType) {
      throw new NotFoundException('Avatar not found');
    }

    return {
      buffer: await this.storageService.readObject(profile.avatarFileKey),
      mimeType: profile.avatarMimeType,
    };
  }

  public async getNotificationSettings(
    userId: string,
  ): Promise<UserNotificationSettingsOverview> {
    const profile = await this.prisma.profile.findUnique({
      where: {
        userId,
      },
      select: {
        dmNotificationDefault: true,
        hubNotificationDefault: true,
        lobbyNotificationDefault: true,
      },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    const [hubMemberships, lobbyOverrides, accessibleLobbies] =
      await Promise.all([
        this.prisma.hubMember.findMany({
          where: {
            userId,
          },
          include: {
            hub: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        }),
        this.prisma.lobbyNotificationOverride.findMany({
          where: {
            userId,
          },
          include: {
            lobby: {
              select: {
                id: true,
                name: true,
                hub: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        }),
        this.prisma.lobby.findMany({
          where: {
            hub: {
              members: {
                some: {
                  userId,
                },
              },
            },
          },
          select: {
            id: true,
            name: true,
            isPrivate: true,
            createdByUserId: true,
            hub: {
              select: {
                id: true,
                name: true,
                members: {
                  where: {
                    userId,
                  },
                  select: {
                    role: true,
                    notificationSetting: true,
                  },
                },
              },
            },
            accessMembers: {
              where: {
                userId,
              },
              select: {
                userId: true,
              },
            },
          },
          orderBy: [
            {
              createdAt: 'asc',
            },
          ],
        }),
      ]);

    const overrideMap = new Map(
      lobbyOverrides.map((item) => [item.lobbyId, item.notificationSetting]),
    );

    return {
      defaults: {
        dmNotificationDefault: profile.dmNotificationDefault,
        hubNotificationDefault: profile.hubNotificationDefault,
        lobbyNotificationDefault: profile.lobbyNotificationDefault,
      },
      hubs: hubMemberships.map((membership) => ({
        hubId: membership.hubId,
        hubName: membership.hub.name,
        setting: membership.notificationSetting,
      })),
      lobbies: accessibleLobbies
        .filter((lobby) => {
          const membership = lobby.hub.members[0] ?? null;

          if (!membership) {
            return false;
          }

          if (!lobby.isPrivate) {
            return true;
          }

          if (lobby.createdByUserId === userId) {
            return true;
          }

          if (
            membership.role === 'OWNER' ||
            membership.role === 'ADMIN' ||
            membership.role === 'MODERATOR'
          ) {
            return true;
          }

          return lobby.accessMembers.some((member) => member.userId === userId);
        })
        .map((lobby) => {
          const membership = lobby.hub.members[0];
          const override = overrideMap.get(lobby.id);
          const inheritedSetting =
            override ??
            membership?.notificationSetting ??
            profile.lobbyNotificationDefault;

          return {
            hubId: lobby.hub.id,
            hubName: lobby.hub.name,
            lobbyId: lobby.id,
            lobbyName: lobby.name,
            setting: inheritedSetting,
            inherited: !override,
          };
        }),
    };
  }

  public async updateNotificationDefaults(
    userId: string,
    input: UpdateViewerNotificationDefaultsInput,
    requestMetadata: RequestMetadata,
  ): Promise<UserNotificationSettingsOverview> {
    await this.prisma.profile.update({
      where: {
        userId,
      },
      data: {
        dmNotificationDefault: input.dmNotificationDefault,
        hubNotificationDefault: input.hubNotificationDefault,
        lobbyNotificationDefault: input.lobbyNotificationDefault,
      },
    });

    await this.auditService.write({
      action: 'users.notification_defaults.update',
      entityType: 'Profile',
      entityId: userId,
      actorUserId: userId,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      metadata: {
        dmNotificationDefault: input.dmNotificationDefault,
        hubNotificationDefault: input.hubNotificationDefault,
        lobbyNotificationDefault: input.lobbyNotificationDefault,
      },
    });

    return this.getNotificationSettings(userId);
  }

  public async updateHubNotificationSetting(
    userId: string,
    hubId: string,
    notificationSetting: NotificationSetting,
    requestMetadata: RequestMetadata,
  ) {
    const membership = await this.prisma.hubMember.findUnique({
      where: {
        hubId_userId: {
          hubId,
          userId,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('Hub membership is required');
    }

    await this.prisma.hubMember.update({
      where: {
        id: membership.id,
      },
      data: {
        notificationSetting,
      },
    });

    await this.auditService.write({
      action: 'users.hub_notification.update',
      entityType: 'HubMember',
      entityId: membership.id,
      actorUserId: userId,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      metadata: {
        hubId,
        notificationSetting,
      },
    });

    return {
      hubId,
      notificationSetting,
    };
  }

  public async updateLobbyNotificationSetting(
    userId: string,
    hubId: string,
    lobbyId: string,
    notificationSetting: NotificationSetting,
    requestMetadata: RequestMetadata,
  ) {
    const membership = await this.prisma.hubMember.findUnique({
      where: {
        hubId_userId: {
          hubId,
          userId,
        },
      },
      select: {
        role: true,
      },
    });

    if (!membership) {
      throw new ForbiddenException('Hub membership is required');
    }

    const lobby = await this.prisma.lobby.findFirst({
      where: {
        id: lobbyId,
        hubId,
      },
      select: {
        id: true,
        isPrivate: true,
        createdByUserId: true,
        accessMembers: {
          where: {
            userId,
          },
          select: {
            userId: true,
          },
        },
      },
    });

    if (!lobby) {
      throw new NotFoundException('Lobby not found');
    }

    if (
      lobby.isPrivate &&
      membership.role !== 'OWNER' &&
      membership.role !== 'ADMIN' &&
      membership.role !== 'MODERATOR' &&
      lobby.createdByUserId !== userId &&
      !lobby.accessMembers.some((member) => member.userId === userId)
    ) {
      throw new ForbiddenException('Private lobby access denied');
    }

    const override = await this.prisma.lobbyNotificationOverride.upsert({
      where: {
        lobbyId_userId: {
          lobbyId,
          userId,
        },
      },
      create: {
        lobbyId,
        userId,
        notificationSetting,
      },
      update: {
        notificationSetting,
      },
    });

    await this.auditService.write({
      action: 'users.lobby_notification.update',
      entityType: 'LobbyNotificationOverride',
      entityId: override.id,
      actorUserId: userId,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      metadata: {
        hubId,
        lobbyId,
        notificationSetting,
      },
    });

    return {
      lobbyId,
      notificationSetting,
    };
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
        platformBlock: null,
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
