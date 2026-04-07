import {
  ConflictException,
  ForbiddenException,
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
import { AuditService } from '../audit/audit.service';
import { EnvService } from '../env/env.service';
import { InvitesService } from '../invites/invites.service';
import {
  publicProfileSelect,
  publicUserSelect,
  toPublicUser,
} from './auth.mapper';
import { SessionService } from './session.service';

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
        requestMetadata,
        transaction,
      );

      await this.auditService.write(
        {
          action: 'auth.register',
          entityType: 'User',
          entityId: user.id,
          actorUserId: user.id,
          ipAddress: requestMetadata.ipAddress,
          userAgent: requestMetadata.userAgent,
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

    if (!user) {
      console.info(`[auth/login] user_not_found login=${normalizedLogin}`);
      throw new UnauthorizedException({
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'Неверный логин, почта или пароль.',
      });
    }

    const passwordMatches = await argon2.verify(
      user.passwordHash,
      input.password,
    );

    if (!passwordMatches) {
      console.info(`[auth/login] invalid_password userId=${user.id}`);
      throw new UnauthorizedException({
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'Неверный логин, почта или пароль.',
      });
    }

    if (user.platformBlock) {
      console.warn(`[auth/login] blocked_user userId=${user.id}`);
      throw new ForbiddenException({
        code: 'AUTH_ACCOUNT_BLOCKED',
        message: 'Аккаунт заблокирован модерацией.',
      });
    }

    const session = await this.sessionService.createSessionRecord(
      user.id,
      requestMetadata,
    );
    await this.sessionService.scheduleSessionExpiry(
      session.sessionId,
      session.expiresAt,
    );

    await this.auditService.write({
      action: 'auth.login',
      entityType: 'User',
      entityId: user.id,
      actorUserId: user.id,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
    });

    console.info(`[auth/login] session_created userId=${user.id}`);

    const profile =
      user.profile ??
      (await this.prisma.profile.upsert({
        where: {
          userId: user.id,
        },
        update: {},
        create: {
          userId: user.id,
          displayName: user.username,
        },
        select: publicProfileSelect,
      }));

    return {
      session,
      user: toPublicUser({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        profile,
      }),
    };
  }

  public async logout(
    userId: string,
    rawToken: string,
    requestMetadata: RequestMetadata,
  ): Promise<void> {
    await this.sessionService.revokeSession(rawToken);
    await this.auditService.write({
      action: 'auth.logout',
      entityType: 'User',
      entityId: userId,
      actorUserId: userId,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
    });
  }
}
