import {
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  registerSchema,
  type LoginInput,
  type RegisterInput,
} from '@lobby/shared';
import * as argon2 from 'argon2';
import { PresenceStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { RequestMetadata } from '../../common/interfaces/request-metadata.interface';
import { normalizeRequestMetadata } from '../../common/utils/request-metadata.util';
import { AuditService } from '../audit/audit.service';
import { EnvService } from '../env/env.service';
import { InvitesService } from '../invites/invites.service';
import {
  publicProfileSelect,
  publicUserSelect,
  toPublicUser,
} from './auth.mapper';
import { SessionService } from './session.service';

const AUTH_LOGIN_TRACE = 'auth-login-trace-v3';

@Injectable()
export class AuthService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly envService: EnvService,
    private readonly invitesService: InvitesService,
    private readonly sessionService: SessionService,
  ) {}

  public async register(
    input: RegisterInput,
    requestMetadata: RequestMetadata,
  ) {
    const env = this.envService.getValues();
    const normalizedInput = registerSchema.parse(input);
    const normalizedRequestMetadata = normalizeRequestMetadata(requestMetadata);
    const passwordHash = await argon2.hash(normalizedInput.password, {
      type: argon2.argon2id,
      memoryCost: env.ARGON2_MEMORY_COST,
      timeCost: env.ARGON2_TIME_COST,
      parallelism: env.ARGON2_PARALLELISM,
    });

    const result = await this.prisma.$transaction(async (transaction) => {
      const existingUser = await transaction.user.findFirst({
        where: {
          OR: [
            {
              email: normalizedInput.email,
            },
            {
              username: normalizedInput.username,
            },
          ],
        },
        select: {
          id: true,
          email: true,
          username: true,
        },
      });

      if (existingUser) {
        if (existingUser.email === normalizedInput.email) {
          throw new ConflictException({
            code: 'AUTH_EMAIL_TAKEN',
            message: 'Эта почта уже используется.',
          });
        }

        throw new ConflictException({
          code: 'AUTH_USERNAME_TAKEN',
          message: 'Этот логин уже занят.',
        });
      }

      const invite = await this.invitesService.consumeInvite(
        normalizedInput.accessKey,
        transaction,
      );

      const user = await transaction.user.create({
        data: {
          username: normalizedInput.username,
          email: normalizedInput.email,
          passwordHash,
          role: invite.role,
          usedInviteId: invite.id,
          profile: {
            create: {
              displayName: normalizedInput.displayName.trim(),
              presence: PresenceStatus.ONLINE,
            },
          },
        },
        select: publicUserSelect,
      });

      const session = await this.sessionService.createSessionRecord(
        user.id,
        normalizedRequestMetadata,
        transaction,
      );

      await this.auditService.write(
        {
          action: 'auth.register',
          entityType: 'User',
          entityId: user.id,
          actorUserId: user.id,
          ipAddress: normalizedRequestMetadata.ipAddress,
          userAgent: normalizedRequestMetadata.userAgent,
          metadata: {
            inviteKeyId: invite.id,
          },
        },
        transaction,
      );

      return {
        session,
        user,
      };
    });

    await this.sessionService.scheduleSessionExpiry(
      result.session.sessionId,
      result.session.expiresAt,
    );

    return {
      session: result.session,
      user: toPublicUser(result.user),
    };
  }

  public async login(input: LoginInput, requestMetadata: RequestMetadata) {
    const normalizedLogin = input.login.trim().toLowerCase();
    const normalizedRequestMetadata = normalizeRequestMetadata(requestMetadata);
    let stage = 'stage=2 enter_service';

    console.info(
      `[auth/login][trace=${AUTH_LOGIN_TRACE}] ${stage} login=${input.login}`,
    );

    try {
      stage = 'stage=3 normalized_login';
      console.info(
        `[auth/login][trace=${AUTH_LOGIN_TRACE}] ${stage} normalized=${normalizedLogin} mode=${normalizedLogin.includes('@') ? 'email' : 'username'}`,
      );

      const user = await this.prisma.user.findFirst({
        where: normalizedLogin.includes('@')
          ? {
              email: normalizedLogin,
            }
          : {
              username: normalizedLogin,
            },
        select: {
          ...publicUserSelect,
          passwordHash: true,
          platformBlock: {
            select: {
              id: true,
            },
          },
        },
      });

      stage = 'stage=4 user_lookup_done';
      console.info(
        `[auth/login][trace=${AUTH_LOGIN_TRACE}] ${stage} login=${normalizedLogin} found=${Boolean(user)}`,
      );

      if (!user) {
        console.info(
          `[auth/login][trace=${AUTH_LOGIN_TRACE}] ${stage} user_not_found login=${normalizedLogin}`,
        );
        throw new UnauthorizedException({
          code: 'AUTH_INVALID_CREDENTIALS',
          message: 'Неверный логин, почта или пароль.',
        });
      }

      const hasPasswordHash =
        typeof user.passwordHash === 'string' &&
        user.passwordHash.trim().length > 0;

      stage = 'stage=5 password_hash_checked';
      console.info(
        `[auth/login][trace=${AUTH_LOGIN_TRACE}] ${stage} userId=${user.id} hasPasswordHash=${hasPasswordHash}`,
      );

      if (!hasPasswordHash) {
        console.warn(
          `[auth/login][trace=${AUTH_LOGIN_TRACE}] ${stage} missing_password_hash userId=${user.id}`,
        );
        throw new UnauthorizedException({
          code: 'AUTH_INVALID_CREDENTIALS',
          message: 'Неверный логин, почта или пароль.',
        });
      }

      console.info(
        `[auth/login][trace=${AUTH_LOGIN_TRACE}] ${stage} verify:start userId=${user.id}`,
      );
      let passwordMatches = false;

      try {
        passwordMatches = await argon2.verify(
          user.passwordHash,
          input.password,
        );
      } catch (error) {
        console.warn(
          `[auth/login][trace=${AUTH_LOGIN_TRACE}] ${stage} verify:invalid_hash userId=${user.id}`,
          error,
        );
        throw new UnauthorizedException({
          code: 'AUTH_INVALID_CREDENTIALS',
          message: 'Неверный логин, почта или пароль.',
        });
      }

      stage = 'stage=6 verify_done';
      console.info(
        `[auth/login][trace=${AUTH_LOGIN_TRACE}] ${stage} userId=${user.id} matched=${passwordMatches}`,
      );

      if (!passwordMatches) {
        console.info(
          `[auth/login][trace=${AUTH_LOGIN_TRACE}] ${stage} invalid_password userId=${user.id}`,
        );
        throw new UnauthorizedException({
          code: 'AUTH_INVALID_CREDENTIALS',
          message: 'Неверный логин, почта или пароль.',
        });
      }

      if (user.platformBlock) {
        console.warn(
          `[auth/login][trace=${AUTH_LOGIN_TRACE}] ${stage} blocked_user userId=${user.id}`,
        );
        throw new ForbiddenException({
          code: 'AUTH_ACCOUNT_BLOCKED',
          message: 'Аккаунт заблокирован модерацией.',
        });
      }

      stage = 'stage=7 tokens_issued';
      console.info(
        `[auth/login][trace=${AUTH_LOGIN_TRACE}] ${stage} session:create:start userId=${user.id}`,
      );
      const session = await this.sessionService.createSessionRecord(
        user.id,
        normalizedRequestMetadata,
      );
      stage = 'stage=8 session_saved';
      console.info(
        `[auth/login][trace=${AUTH_LOGIN_TRACE}] ${stage} session:create:done userId=${user.id} sessionId=${session.sessionId}`,
      );
      let expiryScheduled = false;

      try {
        expiryScheduled = await this.sessionService.scheduleSessionExpiry(
          session.sessionId,
          session.expiresAt,
        );
      } catch (error) {
        console.error(
          `[auth/login][trace=${AUTH_LOGIN_TRACE}] ${stage} expiry_schedule_failed userId=${user.id} sessionId=${session.sessionId}`,
          error,
        );
      }

      console.info(
        `[auth/login][trace=${AUTH_LOGIN_TRACE}] ${stage} expiry_scheduled=${expiryScheduled} userId=${user.id} sessionId=${session.sessionId}`,
      );

      stage = 'stage=9 audit_saved';
      try {
        await this.auditService.write({
          action: 'auth.login',
          entityType: 'User',
          entityId: user.id,
          actorUserId: user.id,
          ipAddress: normalizedRequestMetadata.ipAddress,
          userAgent: normalizedRequestMetadata.userAgent,
        });
        console.info(
          `[auth/login][trace=${AUTH_LOGIN_TRACE}] ${stage} success userId=${user.id}`,
        );
      } catch (error) {
        console.error(
          `[auth/login][trace=${AUTH_LOGIN_TRACE}] ${stage} audit_failed userId=${user.id}`,
          error,
        );
      }

      let profile = user.profile;

      if (!profile) {
        try {
          profile = await this.prisma.profile.upsert({
            where: {
              userId: user.id,
            },
            update: {},
            create: {
              userId: user.id,
              displayName: user.username,
            },
            select: publicProfileSelect,
          });
          console.info(
            `[auth/login][trace=${AUTH_LOGIN_TRACE}] ${stage} profile_restored userId=${user.id}`,
          );
        } catch (error) {
          console.error(
            `[auth/login][trace=${AUTH_LOGIN_TRACE}] ${stage} profile_restore_failed userId=${user.id}`,
            error,
          );
          profile = null;
        }
      }

      stage = 'stage=10 response_mapped';
      const publicUser = toPublicUser({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        profile,
      });

      console.info(
        `[auth/login][trace=${AUTH_LOGIN_TRACE}] ${stage} success userId=${user.id}`,
      );

      return {
        session,
        user: publicUser,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      console.error(
        `[auth/login][trace=${AUTH_LOGIN_TRACE}] ${stage} unexpected_failure login=${normalizedLogin}`,
        error,
      );
      throw error;
    }
  }

  public async logout(
    userId: string,
    rawToken: string,
    requestMetadata: RequestMetadata,
  ): Promise<void> {
    const normalizedRequestMetadata = normalizeRequestMetadata(requestMetadata);

    await this.sessionService.revokeSession(rawToken);
    await this.auditService.write({
      action: 'auth.logout',
      entityType: 'User',
      entityId: userId,
      actorUserId: userId,
      ipAddress: normalizedRequestMetadata.ipAddress,
      userAgent: normalizedRequestMetadata.userAgent,
    });
  }
}
