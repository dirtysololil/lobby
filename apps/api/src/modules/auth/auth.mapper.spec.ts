import {
  AvatarPreset,
  CallRingtoneMode,
  CallRingtonePreset,
  PresenceStatus,
} from '@prisma/client';
import { toPublicUser, type PublicUserRecord } from './auth.mapper';

describe('toPublicUser', () => {
  it('uses a safe fallback when profile is missing', () => {
    const user = {
      id: 'cmc0x6nsp0000v0x8r2n8d4q1',
      username: 'member_test',
      email: 'user@example.com',
      role: 'MEMBER',
      createdAt: new Date('2026-04-07T10:00:00.000Z'),
      profile: null,
    } satisfies PublicUserRecord;

    expect(toPublicUser(user)).toEqual({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      isOnline: false,
      lastSeenAt: null,
      createdAt: '2026-04-07T10:00:00.000Z',
      profile: {
        displayName: 'member_test',
        bio: null,
        presence: PresenceStatus.OFFLINE,
        avatarPreset: AvatarPreset.NONE,
        avatar: {
          fileKey: null,
          originalName: null,
          mimeType: null,
          bytes: null,
          width: null,
          height: null,
          frameCount: null,
          animationDurationMs: null,
          isAnimated: false,
        },
        callRingtonePreset: CallRingtonePreset.CLASSIC,
        callRingtoneMode: CallRingtoneMode.BUILTIN,
        customRingtone: {
          fileKey: null,
          originalName: null,
          mimeType: null,
          bytes: null,
        },
        updatedAt: '2026-04-07T10:00:00.000Z',
      },
    });
  });
});
