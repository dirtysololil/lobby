import {
  blockRecordSchema,
  friendshipRecordSchema,
  type BlockRecord,
  type FriendshipRecord,
  type FriendshipState,
} from '@lobby/shared';
import { FriendshipStatus, type Block, type Friendship } from '@prisma/client';
import { toPublicUser, type PublicUserRecord } from '../auth/auth.mapper';

export function toFriendshipState(
  friendship: Friendship,
  viewerId: string,
): FriendshipState {
  if (friendship.status === FriendshipStatus.ACCEPTED) {
    return 'ACCEPTED';
  }

  if (friendship.status === FriendshipStatus.REMOVED) {
    return 'REMOVED';
  }

  return friendship.requesterId === viewerId
    ? 'OUTGOING_REQUEST'
    : 'INCOMING_REQUEST';
}

export function toFriendshipRecord(
  friendship: Friendship,
  otherUser: PublicUserRecord,
  viewerId: string,
): FriendshipRecord {
  return friendshipRecordSchema.parse({
    id: friendship.id,
    createdAt: friendship.createdAt.toISOString(),
    updatedAt: friendship.updatedAt.toISOString(),
    respondedAt: friendship.respondedAt
      ? friendship.respondedAt.toISOString()
      : null,
    otherUser: toPublicUser(otherUser),
    state: toFriendshipState(friendship, viewerId),
  });
}

export function toBlockRecord(
  block: Block,
  blockedUser: PublicUserRecord,
): BlockRecord {
  return blockRecordSchema.parse({
    id: block.id,
    createdAt: block.createdAt.toISOString(),
    blockedUser: toPublicUser(blockedUser),
  });
}
