import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { RequestMetadata } from '../../common/interfaces/request-metadata.interface';
import {
  generateSessionToken,
  hashOpaqueToken,
} from '../../common/utils/opaque-token.util';
import { EnvService } from '../env/env.service';
import { QueueService } from '../queue/queue.service';
import { publicUserSelect, toPublicUser } from './auth.mapper';
import type { ResolvedSession } from './auth.types';

type SessionClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class SessionService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly envService: EnvService,
    private readonly queueService: QueueService,
  ) {}

  public async createSessionRecord(
    userId: string,
    requestMetadata: RequestMetadata,
    client?: SessionClient,
  ): Promise<{ sessionId: string; rawToken: string; expiresAt: Date }> {
    const target = client ?? this.prisma;
    const env = this.envService.getValues();
    const rawToken = generateSessionToken();
    const tokenHash = hashOpaqueToken(rawToken, env.SESSION_SECRET, 'session');
    const expiresAt = new Date(
      Date.now() + env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1_000,
    );

    const session = await target.session.create({
      data: {
        userId,
        tokenHash,
        ipAddress: requestMetadata.ipAddress ?? undefined,
        userAgent: requestMetadata.userAgent ?? undefined,
        expiresAt,
      },
      select: {
        id: true,
      },
    });

    return {
      sessionId: session.id,
      rawToken,
      expiresAt,
    };
  }

  public async scheduleSessionExpiry(
    sessionId: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.queueService.scheduleSessionExpiry(sessionId, expiresAt);
  }

  public async resolveSession(
    rawToken: string,
  ): Promise<ResolvedSession | null> {
    const env = this.envService.getValues();
    const tokenHash = hashOpaqueToken(rawToken, env.SESSION_SECRET, 'session');
    const now = new Date();

    const session = await this.prisma.session.findUnique({
      where: {
        tokenHash,
      },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        revokedAt: true,
        lastActiveAt: true,
        user: {
          select: {
            ...publicUserSelect,
            platformBlock: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    if (!session || session.revokedAt || session.expiresAt <= now) {
      if (session && !session.revokedAt) {
        await this.revokeExpiredSessionById(session.id);
      }

      return null;
    }

    if (session.user.platformBlock) {
      await this.prisma.session.update({
        where: {
          id: session.id,
        },
        data: {
          revokedAt: now,
        },
      });

      return null;
    }

    if (session.lastActiveAt.getTime() < now.getTime() - 15 * 60 * 1_000) {
      await this.prisma.session.update({
        where: {
          id: session.id,
        },
        data: {
          lastActiveAt: now,
        },
      });
    }

    return {
      sessionId: session.id,
      user: toPublicUser(session.user),
    };
  }

  public async revokeSession(rawToken: string): Promise<void> {
    const env = this.envService.getValues();
    const tokenHash = hashOpaqueToken(rawToken, env.SESSION_SECRET, 'session');

    const session = await this.prisma.session.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
      },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!session) {
      return;
    }

    await this.prisma.session.update({
      where: {
        id: session.id,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  public async revokeExpiredSessionById(sessionId: string): Promise<void> {
    const session = await this.prisma.session.findUnique({
      where: {
        id: sessionId,
      },
      select: {
        id: true,
        userId: true,
        revokedAt: true,
        expiresAt: true,
      },
    });

    if (!session || session.revokedAt || session.expiresAt > new Date()) {
      return;
    }

    await this.prisma.session.update({
      where: {
        id: session.id,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }
}
