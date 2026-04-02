import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  BlockRecord,
  FriendshipRecord,
  PublicUser,
  UserRelationshipSummary,
} from '@lobby/shared';
import { FriendshipStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { RequestMetadata } from '../../common/interfaces/request-metadata.interface';
import { buildUserPairKey } from '../../common/utils/user-pair-key.util';
import { AuditService } from '../audit/audit.service';
import { publicUserSelect } from '../auth/auth.mapper';
import {
  toBlockRecord,
  toFriendshipRecord,
  toFriendshipState,
} from './relationships.mapper';

@Injectable()
export class RelationshipsService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  public async listFriendships(viewerId: string): Promise<FriendshipRecord[]> {
    const friendships = await this.prisma.friendship.findMany({
      where: {
        OR: [
          {
            requesterId: viewerId,
          },
          {
            addresseeId: viewerId,
          },
        ],
      },
      include: {
        requester: {
          select: publicUserSelect,
        },
        addressee: {
          select: publicUserSelect,
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return friendships.map((friendship) =>
      toFriendshipRecord(
        friendship,
        friendship.requesterId === viewerId
          ? friendship.addressee
          : friendship.requester,
        viewerId,
      ),
    );
  }

  public async listBlocks(viewerId: string): Promise<BlockRecord[]> {
    const blocks = await this.prisma.block.findMany({
      where: {
        blockerId: viewerId,
      },
      include: {
        blocked: {
          select: publicUserSelect,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return blocks.map((block) => toBlockRecord(block, block.blocked));
  }

  public async sendFriendRequest(
    actor: PublicUser,
    targetUsername: string,
    requestMetadata: RequestMetadata,
  ): Promise<FriendshipRecord> {
    const targetUser = await this.getTargetUserByUsername(
      actor.id,
      targetUsername,
    );
    await this.assertInteractionAllowed(actor.id, targetUser.id);

    const pairKey = buildUserPairKey(actor.id, targetUser.id);
    const existing = await this.prisma.friendship.findUnique({
      where: {
        pairKey,
      },
      include: {
        requester: {
          select: publicUserSelect,
        },
        addressee: {
          select: publicUserSelect,
        },
      },
    });

    if (existing) {
      if (existing.status === FriendshipStatus.ACCEPTED) {
        throw new ConflictException('Friendship already accepted');
      }

      if (existing.status === FriendshipStatus.PENDING) {
        if (existing.requesterId === actor.id) {
          throw new ConflictException('Friend request already sent');
        }

        throw new ConflictException('Incoming request already exists');
      }
    }

    const friendship = await this.prisma.friendship.upsert({
      where: {
        pairKey,
      },
      create: {
        pairKey,
        requesterId: actor.id,
        addresseeId: targetUser.id,
        status: FriendshipStatus.PENDING,
      },
      update: {
        requesterId: actor.id,
        addresseeId: targetUser.id,
        status: FriendshipStatus.PENDING,
        respondedAt: null,
      },
      include: {
        requester: {
          select: publicUserSelect,
        },
        addressee: {
          select: publicUserSelect,
        },
      },
    });

    await this.auditService.write({
      action: 'relationships.friend_request.send',
      entityType: 'Friendship',
      entityId: friendship.id,
      actorUserId: actor.id,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      metadata: {
        targetUserId: targetUser.id,
      },
    });

    return toFriendshipRecord(friendship, friendship.addressee, actor.id);
  }

  public async acceptFriendRequest(
    actor: PublicUser,
    targetUsername: string,
    requestMetadata: RequestMetadata,
  ): Promise<FriendshipRecord> {
    const targetUser = await this.getTargetUserByUsername(
      actor.id,
      targetUsername,
    );
    const friendship = await this.getFriendshipByPairOrThrow(
      actor.id,
      targetUser.id,
    );

    if (
      friendship.status !== FriendshipStatus.PENDING ||
      friendship.addresseeId !== actor.id
    ) {
      throw new ConflictException('Incoming friend request not found');
    }

    const updatedFriendship = await this.prisma.friendship.update({
      where: {
        id: friendship.id,
      },
      data: {
        status: FriendshipStatus.ACCEPTED,
        respondedAt: new Date(),
      },
      include: {
        requester: {
          select: publicUserSelect,
        },
        addressee: {
          select: publicUserSelect,
        },
      },
    });

    await this.auditService.write({
      action: 'relationships.friend_request.accept',
      entityType: 'Friendship',
      entityId: friendship.id,
      actorUserId: actor.id,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      metadata: {
        targetUserId: targetUser.id,
      },
    });

    return toFriendshipRecord(
      updatedFriendship,
      updatedFriendship.requester,
      actor.id,
    );
  }

  public async removeFriendship(
    actor: PublicUser,
    targetUsername: string,
    requestMetadata: RequestMetadata,
  ): Promise<FriendshipRecord> {
    const targetUser = await this.getTargetUserByUsername(
      actor.id,
      targetUsername,
    );
    const friendship = await this.getFriendshipByPairOrThrow(
      actor.id,
      targetUser.id,
    );

    const updatedFriendship = await this.prisma.friendship.update({
      where: {
        id: friendship.id,
      },
      data: {
        status: FriendshipStatus.REMOVED,
        respondedAt: new Date(),
      },
      include: {
        requester: {
          select: publicUserSelect,
        },
        addressee: {
          select: publicUserSelect,
        },
      },
    });

    await this.auditService.write({
      action: 'relationships.friendship.remove',
      entityType: 'Friendship',
      entityId: friendship.id,
      actorUserId: actor.id,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      metadata: {
        targetUserId: targetUser.id,
      },
    });

    return toFriendshipRecord(
      updatedFriendship,
      updatedFriendship.requesterId === actor.id
        ? updatedFriendship.addressee
        : updatedFriendship.requester,
      actor.id,
    );
  }

  public async blockUser(
    actor: PublicUser,
    targetUsername: string,
    requestMetadata: RequestMetadata,
  ): Promise<BlockRecord> {
    const targetUser = await this.getTargetUserByUsername(
      actor.id,
      targetUsername,
    );

    const result = await this.prisma.$transaction(async (transaction) => {
      const block = await transaction.block.upsert({
        where: {
          blockerId_blockedId: {
            blockerId: actor.id,
            blockedId: targetUser.id,
          },
        },
        create: {
          blockerId: actor.id,
          blockedId: targetUser.id,
        },
        update: {},
        include: {
          blocked: {
            select: publicUserSelect,
          },
        },
      });

      const friendship = await transaction.friendship.findUnique({
        where: {
          pairKey: buildUserPairKey(actor.id, targetUser.id),
        },
      });

      if (friendship && friendship.status !== FriendshipStatus.REMOVED) {
        await transaction.friendship.update({
          where: {
            id: friendship.id,
          },
          data: {
            status: FriendshipStatus.REMOVED,
            respondedAt: new Date(),
          },
        });
      }

      return block;
    });

    await this.auditService.write({
      action: 'relationships.block.create',
      entityType: 'Block',
      entityId: result.id,
      actorUserId: actor.id,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      metadata: {
        targetUserId: targetUser.id,
      },
    });

    return toBlockRecord(result, result.blocked);
  }

  public async unblockUser(
    actor: PublicUser,
    targetUsername: string,
    requestMetadata: RequestMetadata,
  ): Promise<void> {
    const targetUser = await this.getTargetUserByUsername(
      actor.id,
      targetUsername,
    );

    const block = await this.prisma.block.findUnique({
      where: {
        blockerId_blockedId: {
          blockerId: actor.id,
          blockedId: targetUser.id,
        },
      },
    });

    if (!block) {
      throw new NotFoundException('Block not found');
    }

    await this.prisma.block.delete({
      where: {
        id: block.id,
      },
    });

    await this.auditService.write({
      action: 'relationships.block.remove',
      entityType: 'Block',
      entityId: block.id,
      actorUserId: actor.id,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      metadata: {
        targetUserId: targetUser.id,
      },
    });
  }

  public async assertInteractionAllowed(
    actorUserId: string,
    targetUserId: string,
  ): Promise<void> {
    const blockStatus = await this.getBlockStatus(actorUserId, targetUserId);

    if (blockStatus.isBlockedByViewer || blockStatus.hasBlockedViewer) {
      throw new ForbiddenException(
        'Interaction is forbidden because one user blocked the other',
      );
    }
  }

  public async getRelationshipSummary(
    viewerId: string,
    targetUserId: string,
  ): Promise<UserRelationshipSummary> {
    const pairKey = buildUserPairKey(viewerId, targetUserId);

    const [friendship, viewerBlock, reverseBlock, dmConversation] =
      await Promise.all([
        this.prisma.friendship.findUnique({
          where: {
            pairKey,
          },
        }),
        this.prisma.block.findUnique({
          where: {
            blockerId_blockedId: {
              blockerId: viewerId,
              blockedId: targetUserId,
            },
          },
        }),
        this.prisma.block.findUnique({
          where: {
            blockerId_blockedId: {
              blockerId: targetUserId,
              blockedId: viewerId,
            },
          },
        }),
        this.prisma.directConversation.findUnique({
          where: {
            pairKey,
          },
          select: {
            id: true,
          },
        }),
      ]);

    return {
      friendshipId: friendship?.id ?? null,
      blockId: viewerBlock?.id ?? null,
      friendshipState: friendship
        ? toFriendshipState(friendship, viewerId)
        : 'NONE',
      isBlockedByViewer: Boolean(viewerBlock),
      hasBlockedViewer: Boolean(reverseBlock),
      dmConversationId: dmConversation?.id ?? null,
    };
  }

  private async getBlockStatus(viewerId: string, targetUserId: string) {
    const [viewerBlock, reverseBlock] = await Promise.all([
      this.prisma.block.findUnique({
        where: {
          blockerId_blockedId: {
            blockerId: viewerId,
            blockedId: targetUserId,
          },
        },
        select: {
          id: true,
        },
      }),
      this.prisma.block.findUnique({
        where: {
          blockerId_blockedId: {
            blockerId: targetUserId,
            blockedId: viewerId,
          },
        },
        select: {
          id: true,
        },
      }),
    ]);

    return {
      isBlockedByViewer: Boolean(viewerBlock),
      hasBlockedViewer: Boolean(reverseBlock),
    };
  }

  private async getTargetUserByUsername(actorUserId: string, username: string) {
    const normalizedUsername = username.trim().toLowerCase();
    const targetUser = await this.prisma.user.findUnique({
      where: {
        username: normalizedUsername,
      },
      select: {
        ...publicUserSelect,
        platformBlock: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    if (targetUser.id === actorUserId) {
      throw new ConflictException('Action on self is not allowed');
    }

    if (targetUser.platformBlock) {
      throw new NotFoundException('User not found');
    }

    return targetUser;
  }

  private async getFriendshipByPairOrThrow(
    firstUserId: string,
    secondUserId: string,
  ) {
    const friendship = await this.prisma.friendship.findUnique({
      where: {
        pairKey: buildUserPairKey(firstUserId, secondUserId),
      },
    });

    if (!friendship) {
      throw new NotFoundException('Friendship not found');
    }

    return friendship;
  }
}
