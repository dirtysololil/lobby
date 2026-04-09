import { publicUserSchema, type PublicUser } from '@lobby/shared';
import {
  AvatarPreset,
  CallRingtoneMode,
  CallRingtonePreset,
  PresenceStatus,
  Prisma,
} from '@prisma/client';

export const publicProfileSelect = {
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
  callRingtoneMode: true,
  updatedAt: true,
} satisfies Prisma.ProfileSelect;

export const publicUserSelect = {
  id: true,
  username: true,
  email: true,
  role: true,
  createdAt: true,
  profile: {
    select: publicProfileSelect,
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
  const profile = user.profile ?? {
    displayName: user.username,
    bio: null,
    presence: PresenceStatus.OFFLINE,
    avatarPreset: AvatarPreset.NONE,
    avatarFileKey: null,
    avatarOriginalName: null,
    avatarMimeType: null,
    avatarBytes: null,
    avatarWidth: null,
    avatarHeight: null,
    avatarFrameCount: null,
    avatarAnimationDurationMs: null,
    avatarIsAnimated: false,
    customRingtoneFileKey: null,
    customRingtoneOriginalName: null,
    customRingtoneMimeType: null,
    customRingtoneBytes: null,
    callRingtonePreset: CallRingtonePreset.CLASSIC,
    callRingtoneMode: CallRingtoneMode.BUILTIN,
    updatedAt: user.createdAt,
  };

  return publicUserSchema.parse({
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    isOnline: false,
    lastSeenAt: options?.lastSeenAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    profile: {
      displayName: profile.displayName,
      bio: profile.bio,
      presence: profile.presence,
      avatarPreset: profile.avatarPreset,
      avatar: {
        fileKey: profile.avatarFileKey,
        originalName: profile.avatarOriginalName,
        mimeType: profile.avatarMimeType,
        bytes: profile.avatarBytes,
        width: profile.avatarWidth,
        height: profile.avatarHeight,
        frameCount: profile.avatarFrameCount,
        animationDurationMs: profile.avatarAnimationDurationMs,
        isAnimated: profile.avatarIsAnimated,
      },
      callRingtonePreset: profile.callRingtonePreset,
      callRingtoneMode: profile.callRingtoneMode,
      customRingtone: {
        fileKey: profile.customRingtoneFileKey,
        originalName: profile.customRingtoneOriginalName,
        mimeType: profile.customRingtoneMimeType,
        bytes: profile.customRingtoneBytes,
      },
      updatedAt: profile.updatedAt.toISOString(),
    },
  });
}
