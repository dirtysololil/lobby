import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  accessKeySchema,
  type CreateInviteInput,
  type InviteCreateResponse,
  type InviteLookupDetails,
  type InviteLookupResponse,
  type InviteSummary,
  type PublicUser,
  type UpdateInviteInput,
} from '@lobby/shared';
import { type InviteKey, type Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { RequestMetadata } from '../../common/interfaces/request-metadata.interface';
import { AuditService } from '../audit/audit.service';
import { EnvService } from '../env/env.service';
import { generateAccessKey, hashOpaqueToken } from './invite-key.util';
import { toInviteSummary } from './invites.mapper';

@Injectable()
export class InvitesService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly envService: EnvService,
  ) {}

  public async listInvites(): Promise<InviteSummary[]> {
    const invites = await this.prisma.inviteKey.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });

    return invites.map(toInviteSummary);
  }

  public async getInvite(inviteId: string): Promise<InviteSummary> {
    const invite = await this.prisma.inviteKey.findUnique({
      where: {
        id: inviteId,
      },
    });

    if (!invite) {
      throw new NotFoundException({
        code: 'INVITE_NOT_FOUND',
        message: 'Инвайт не найден.',
      });
    }

    return toInviteSummary(invite);
  }

  public async createInvite(
    actor: PublicUser,
    input: CreateInviteInput,
    requestMetadata: RequestMetadata,
  ): Promise<InviteCreateResponse> {
    this.assertActorCanAssignRole(actor.role, input.role);

    const rawCode = generateAccessKey();
    const invite = await this.prisma.inviteKey.create({
      data: {
        codeHash: hashOpaqueToken(
          rawCode,
          this.envService.getValues().SESSION_SECRET,
          'invite',
        ),
        label: input.label?.trim() || null,
        role: input.role,
        maxUses: input.maxUses,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        createdByUserId: actor.id,
      },
    });

    await this.auditService.write({
      action: 'invites.create',
      entityType: 'InviteKey',
      entityId: invite.id,
      actorUserId: actor.id,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      metadata: {
        role: invite.role,
        maxUses: invite.maxUses,
        mode: input.mode,
      },
    });

    return {
      invite: toInviteSummary(invite),
      rawCode,
      mode: input.mode,
    };
  }

  public async lookupInvite(
    rawAccessKey: string,
  ): Promise<InviteLookupResponse> {
    const normalizedAccessKey = this.normalizeAccessKey(rawAccessKey);
    const parsedAccessKey = accessKeySchema.safeParse(normalizedAccessKey);

    if (!parsedAccessKey.success) {
      return {
        status: 'INVALID',
        invite: null,
      };
    }

    const invite = await this.findInviteByAccessKey(parsedAccessKey.data);

    if (!invite) {
      return {
        status: 'INVALID',
        invite: null,
      };
    }

    const status = this.getInviteStatus(invite);

    return {
      status,
      invite: status === 'ACTIVE' ? this.toInviteLookupDetails(invite) : null,
    };
  }

  public async updateInvite(
    actor: PublicUser,
    inviteId: string,
    input: UpdateInviteInput,
    requestMetadata: RequestMetadata,
  ): Promise<InviteSummary> {
    const existingInvite = await this.getInviteOrThrow(inviteId);
    this.assertActorCanModifyInvite(actor.role, existingInvite.role);

    if (input.role) {
      this.assertActorCanAssignRole(actor.role, input.role);
    }

    if (
      typeof input.maxUses === 'number' &&
      input.maxUses < existingInvite.usedCount
    ) {
      throw new ConflictException({
        code: 'INVITE_MAX_USES_TOO_LOW',
        message:
          'Лимит использований не может быть меньше уже израсходованных активаций.',
      });
    }

    const updatedInvite = await this.prisma.inviteKey.update({
      where: {
        id: inviteId,
      },
      data: {
        label:
          input.label === undefined ? undefined : input.label?.trim() || null,
        role: input.role,
        maxUses: input.maxUses,
        expiresAt:
          input.expiresAt === undefined
            ? undefined
            : input.expiresAt
              ? new Date(input.expiresAt)
              : null,
      },
    });

    await this.auditService.write({
      action: 'invites.update',
      entityType: 'InviteKey',
      entityId: inviteId,
      actorUserId: actor.id,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
    });

    return toInviteSummary(updatedInvite);
  }

  public async revokeInvite(
    actor: PublicUser,
    inviteId: string,
    requestMetadata: RequestMetadata,
  ): Promise<InviteSummary> {
    const existingInvite = await this.getInviteOrThrow(inviteId);
    this.assertActorCanModifyInvite(actor.role, existingInvite.role);

    const revokedInvite = await this.prisma.inviteKey.update({
      where: {
        id: inviteId,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    await this.auditService.write({
      action: 'invites.revoke',
      entityType: 'InviteKey',
      entityId: inviteId,
      actorUserId: actor.id,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
    });

    return toInviteSummary(revokedInvite);
  }

  public async consumeInvite(
    rawAccessKey: string,
    client?: Prisma.TransactionClient,
  ): Promise<InviteKey> {
    const target = client ?? this.prisma;
    const now = new Date();
    const normalizedAccessKey = this.normalizeAccessKey(rawAccessKey);
    const parsedAccessKey = accessKeySchema.safeParse(normalizedAccessKey);

    if (!parsedAccessKey.success) {
      throw new UnauthorizedException({
        code: 'INVITE_INVALID',
        message: 'Инвайт недействителен.',
      });
    }

    const invite = await this.findInviteByAccessKey(
      parsedAccessKey.data,
      target,
    );

    if (!invite) {
      throw new UnauthorizedException({
        code: 'INVITE_INVALID',
        message: 'Инвайт недействителен.',
      });
    }

    this.assertInviteCanBeConsumed(invite);

    const { count } = await target.inviteKey.updateMany({
      where: {
        id: invite.id,
        revokedAt: null,
        usedCount: {
          lt: invite.maxUses,
        },
        OR: [
          {
            expiresAt: null,
          },
          {
            expiresAt: {
              gt: now,
            },
          },
        ],
      },
      data: {
        usedCount: {
          increment: 1,
        },
      },
    });

    if (count !== 1) {
      throw new ConflictException({
        code: 'INVITE_CONSUME_CONFLICT',
        message:
          'Не удалось активировать инвайт. Попробуйте ещё раз или запросите новую ссылку.',
      });
    }

    return invite;
  }

  private async getInviteOrThrow(inviteId: string): Promise<InviteKey> {
    const invite = await this.prisma.inviteKey.findUnique({
      where: {
        id: inviteId,
      },
    });

    if (!invite) {
      throw new NotFoundException({
        code: 'INVITE_NOT_FOUND',
        message: 'Инвайт не найден.',
      });
    }

    return invite;
  }

  private async findInviteByAccessKey(
    accessKey: string,
    client?: Prisma.TransactionClient,
  ): Promise<InviteKey | null> {
    const target = client ?? this.prisma;

    return target.inviteKey.findUnique({
      where: {
        codeHash: hashOpaqueToken(
          accessKey,
          this.envService.getValues().SESSION_SECRET,
          'invite',
        ),
      },
    });
  }

  private normalizeAccessKey(rawAccessKey: string): string {
    return rawAccessKey.trim().toUpperCase();
  }

  private getInviteStatus(invite: InviteKey): InviteLookupResponse['status'] {
    const now = new Date();

    if (invite.revokedAt) {
      return 'REVOKED';
    }

    if (invite.expiresAt && invite.expiresAt <= now) {
      return 'EXPIRED';
    }

    if (invite.usedCount >= invite.maxUses) {
      return invite.maxUses === 1 ? 'USED' : 'EXHAUSTED';
    }

    return 'ACTIVE';
  }

  private assertInviteCanBeConsumed(invite: InviteKey): void {
    const status = this.getInviteStatus(invite);

    switch (status) {
      case 'REVOKED':
        throw new ForbiddenException({
          code: 'INVITE_REVOKED',
          message: 'Инвайт отключён администратором.',
        });
      case 'EXPIRED':
        throw new ForbiddenException({
          code: 'INVITE_EXPIRED',
          message: 'Срок действия инвайта истёк.',
        });
      case 'USED':
        throw new ForbiddenException({
          code: 'INVITE_USED',
          message: 'Инвайт уже использован.',
        });
      case 'EXHAUSTED':
        throw new ForbiddenException({
          code: 'INVITE_EXHAUSTED',
          message: 'Лимит использований инвайта исчерпан.',
        });
      default:
        return;
    }
  }

  private toInviteLookupDetails(invite: InviteKey): InviteLookupDetails {
    return {
      label: invite.label,
      role: invite.role,
      maxUses: invite.maxUses,
      usedCount: invite.usedCount,
      remainingUses: Math.max(invite.maxUses - invite.usedCount, 0),
      expiresAt: invite.expiresAt?.toISOString() ?? null,
    };
  }

  private assertActorCanAssignRole(
    actorRole: PublicUser['role'],
    role: UserRole,
  ): void {
    if (actorRole === 'ADMIN' && role === UserRole.OWNER) {
      throw new ForbiddenException({
        code: 'INVITE_ROLE_FORBIDDEN',
        message: 'Администратор не может создавать инвайты владельца.',
      });
    }
  }

  private assertActorCanModifyInvite(
    actorRole: PublicUser['role'],
    inviteRole: UserRole,
  ): void {
    if (actorRole === 'ADMIN' && inviteRole === UserRole.OWNER) {
      throw new ForbiddenException({
        code: 'INVITE_ROLE_FORBIDDEN',
        message: 'Администратор не может изменять инвайты владельца.',
      });
    }
  }
}
