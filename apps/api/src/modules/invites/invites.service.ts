import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  type CreateInviteInput,
  type InviteCreateResponse,
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
      throw new NotFoundException('Invite not found');
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
      },
    });

    return {
      invite: toInviteSummary(invite),
      rawCode,
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
      throw new ConflictException('maxUses cannot be lower than usedCount');
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
    const accessKeyHash = hashOpaqueToken(
      rawAccessKey,
      this.envService.getValues().SESSION_SECRET,
      'invite',
    );

    const invite = await target.inviteKey.findUnique({
      where: {
        codeHash: accessKeyHash,
      },
    });

    if (!invite) {
      throw new UnauthorizedException('Access key is invalid');
    }

    if (invite.revokedAt || (invite.expiresAt && invite.expiresAt <= now)) {
      throw new ForbiddenException('Access key is no longer active');
    }

    if (invite.usedCount >= invite.maxUses) {
      throw new ForbiddenException('Access key has no remaining uses');
    }

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
      throw new ConflictException('Access key could not be claimed');
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
      throw new NotFoundException('Invite not found');
    }

    return invite;
  }

  private assertActorCanAssignRole(
    actorRole: PublicUser['role'],
    role: UserRole,
  ): void {
    if (actorRole === 'ADMIN' && role === UserRole.OWNER) {
      throw new ForbiddenException('Admins cannot create owner invites');
    }
  }

  private assertActorCanModifyInvite(
    actorRole: PublicUser['role'],
    inviteRole: UserRole,
  ): void {
    if (actorRole === 'ADMIN' && inviteRole === UserRole.OWNER) {
      throw new ForbiddenException('Admins cannot modify owner invites');
    }
  }
}
