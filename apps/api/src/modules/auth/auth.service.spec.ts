import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import type { RequestMetadata } from '../../common/interfaces/request-metadata.interface';
import { AuthService } from './auth.service';

const requestMetadata: RequestMetadata = {
  ipAddress: '127.0.0.1',
  userAgent: 'jest',
};

function createMockUser(
  overrides: Partial<{
    id: string;
    username: string;
    email: string;
    passwordHash: string;
    role: UserRole;
    createdAt: Date;
    platformBlock: { id: string } | null;
    profile: {
      displayName: string;
      bio: string | null;
      presence: 'ONLINE' | 'IDLE' | 'DND' | 'OFFLINE';
      avatarPreset:
        | 'NONE'
        | 'GOLD_GLOW'
        | 'NEON_BLUE'
        | 'PREMIUM_PURPLE'
        | 'ANIMATED_RING';
      avatarFileKey: string | null;
      avatarOriginalName: string | null;
      avatarMimeType: string | null;
      avatarBytes: number | null;
      avatarWidth: number | null;
      avatarHeight: number | null;
      avatarFrameCount: number | null;
      avatarAnimationDurationMs: number | null;
      avatarIsAnimated: boolean;
      customRingtoneFileKey: string | null;
      customRingtoneOriginalName: string | null;
      customRingtoneMimeType: string | null;
      customRingtoneBytes: number | null;
      callRingtonePreset:
        | 'CLASSIC'
        | 'SOFT'
        | 'DIGITAL'
        | 'PULSE'
        | 'NIGHT'
        | 'CLEAR_SIGNAL';
      updatedAt: Date;
    } | null;
  }> = {},
) {
  const createdAt = overrides.createdAt ?? new Date('2026-04-07T10:00:00.000Z');

  return {
    id: overrides.id ?? 'cmc0x6nsp0000v0x8r2n8d4q1',
    username: overrides.username ?? 'member_test',
    email: overrides.email ?? 'member@test.local',
    passwordHash: overrides.passwordHash ?? '$argon2id$invalid',
    role: overrides.role ?? UserRole.MEMBER,
    createdAt,
    platformBlock: overrides.platformBlock ?? null,
    profile:
      overrides.profile === undefined
        ? {
            displayName: 'Member Test',
            bio: null,
            presence: 'ONLINE' as const,
            avatarPreset: 'NONE' as const,
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
            callRingtonePreset: 'CLASSIC' as const,
            updatedAt: createdAt,
          }
        : overrides.profile,
  };
}

describe('AuthService.login', () => {
  const prisma = {
    user: {
      findFirst: jest.fn(),
    },
    profile: {
      upsert: jest.fn(),
    },
  };
  const auditService = {
    write: jest.fn(),
  };
  const envService = {
    getValues: jest.fn(),
  };
  const invitesService = {
    consumeInvite: jest.fn(),
  };
  const sessionService = {
    createSessionRecord: jest.fn(),
    scheduleSessionExpiry: jest.fn(),
  };

  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(
      prisma as never,
      auditService as never,
      envService as never,
      invitesService as never,
      sessionService as never,
    );
  });

  it('logs in with a username containing "_" and "-" and preserves the username value', async () => {
    const password = 'Passw0rd';
    const passwordHash = await argon2.hash(password);
    const user = createMockUser({
      username: 'vladimir_panin-test',
      passwordHash,
    });

    prisma.user.findFirst.mockResolvedValue(user);
    sessionService.createSessionRecord.mockResolvedValue({
      sessionId: 'session_1',
      rawToken: 'raw_token',
      expiresAt: new Date('2026-04-08T10:00:00.000Z'),
    });
    sessionService.scheduleSessionExpiry.mockResolvedValue(undefined);
    auditService.write.mockResolvedValue(undefined);

    const result = await service.login(
      {
        login: '  Vladimir_Panin-Test  ',
        password,
      },
      requestMetadata,
    );

    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          username: 'vladimir_panin-test',
        },
      }),
    );
    expect(sessionService.createSessionRecord).toHaveBeenCalled();
    expect(result.user.username).toBe('vladimir_panin-test');
  });

  it('returns 401 when the user is missing', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(
      service.login(
        {
          login: 'missing_user',
          password: 'Passw0rd',
        },
        requestMetadata,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('returns 401 when passwordHash is empty instead of crashing with 500', async () => {
    prisma.user.findFirst.mockResolvedValue(
      createMockUser({
        passwordHash: '',
      }),
    );

    await expect(
      service.login(
        {
          login: 'member_test',
          password: 'Passw0rd',
        },
        requestMetadata,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(sessionService.createSessionRecord).not.toHaveBeenCalled();
  });

  it('returns 401 when passwordHash is malformed instead of crashing with 500', async () => {
    prisma.user.findFirst.mockResolvedValue(
      createMockUser({
        passwordHash: 'not-a-valid-argon2-hash',
      }),
    );

    await expect(
      service.login(
        {
          login: 'member_test',
          password: 'Passw0rd',
        },
        requestMetadata,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(sessionService.createSessionRecord).not.toHaveBeenCalled();
  });

  it('restores a missing profile during login instead of failing with 500', async () => {
    const password = 'Passw0rd';
    const passwordHash = await argon2.hash(password);
    const createdAt = new Date('2026-04-07T10:00:00.000Z');
    const user = createMockUser({
      username: 'legacy_member',
      passwordHash,
      createdAt,
      profile: null,
    });
    const restoredProfile = createMockUser({
      createdAt,
    }).profile;

    prisma.user.findFirst.mockResolvedValue(user);
    prisma.profile.upsert.mockResolvedValue(restoredProfile);
    sessionService.createSessionRecord.mockResolvedValue({
      sessionId: 'session_2',
      rawToken: 'raw_token_2',
      expiresAt: new Date('2026-04-08T10:00:00.000Z'),
    });
    sessionService.scheduleSessionExpiry.mockResolvedValue(undefined);
    auditService.write.mockResolvedValue(undefined);

    const result = await service.login(
      {
        login: 'legacy_member',
        password,
      },
      requestMetadata,
    );

    expect(prisma.profile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: user.id,
        },
      }),
    );
    expect(result.user.username).toBe('legacy_member');
  });

  it('returns 403 only when the user is actually blocked', async () => {
    const password = 'Passw0rd';
    const passwordHash = await argon2.hash(password);

    prisma.user.findFirst.mockResolvedValue(
      createMockUser({
        passwordHash,
        platformBlock: {
          id: 'block_1',
        },
      }),
    );

    await expect(
      service.login(
        {
          login: 'member_test',
          password,
        },
        requestMetadata,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
