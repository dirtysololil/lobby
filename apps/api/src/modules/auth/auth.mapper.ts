import { publicUserSchema, type PublicUser } from '@lobby/shared';
import { Prisma } from '@prisma/client';

export const publicUserSelect = {
  id: true,
  username: true,
  email: true,
  role: true,
  createdAt: true,
  profile: {
    select: {
      displayName: true,
      bio: true,
      presence: true,
      avatarPreset: true,
      avatarFileKey: true,
      avatarOriginalName: true,
      avatarMimeType: true,
      avatarBytes: true,
      avatarWidth: true,
      avatarHeight: true,
      avatarFrameCount: true,
      avatarAnimationDurationMs: true,
      avatarIsAnimated: true,
      customRingtoneFileKey: true,
      customRingtoneOriginalName: true,
      customRingtoneMimeType: true,
      customRingtoneBytes: true,
      callRingtonePreset: true,
      updatedAt: true,
    },
  },
} satisfies Prisma.UserSelect;

export type PublicUserRecord = Prisma.UserGetPayload<{
  select: typeof publicUserSelect;
}>;

export function toPublicUser(
  user: PublicUserRecord,
  options?: {
    lastSeenAt?: Date | null;
  },
): PublicUser {
  if (!user.profile) {
    throw new Error(`Profile is missing for user ${user.id}`);
  }

  return publicUserSchema.parse({
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    isOnline: false,
    lastSeenAt: options?.lastSeenAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    profile: {
      displayName: user.profile.displayName,
      bio: user.profile.bio,
      presence: user.profile.presence,
      avatarPreset: user.profile.avatarPreset,
      avatar: {
        fileKey: user.profile.avatarFileKey,
        originalName: user.profile.avatarOriginalName,
        mimeType: user.profile.avatarMimeType,
        bytes: user.profile.avatarBytes,
        width: user.profile.avatarWidth,
        height: user.profile.avatarHeight,
        frameCount: user.profile.avatarFrameCount,
        animationDurationMs: user.profile.avatarAnimationDurationMs,
        isAnimated: user.profile.avatarIsAnimated,
      },
      callRingtonePreset: user.profile.callRingtonePreset,
      customRingtone: {
        fileKey: user.profile.customRingtoneFileKey,
        originalName: user.profile.customRingtoneOriginalName,
        mimeType: user.profile.customRingtoneMimeType,
        bytes: user.profile.customRingtoneBytes,
      },
      updatedAt: user.profile.updatedAt.toISOString(),
    },
  });
}
