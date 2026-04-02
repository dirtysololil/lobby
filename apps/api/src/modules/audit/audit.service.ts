import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

type AuditClient = Prisma.TransactionClient | PrismaService;

export interface AuditLogInput {
  action: string;
  entityType: string;
  entityId?: string | null;
  actorUserId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  public constructor(private readonly prisma: PrismaService) {}

  public async write(
    input: AuditLogInput,
    client?: AuditClient,
  ): Promise<void> {
    const target = client ?? this.prisma;

    await target.auditLog.create({
      data: {
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? undefined,
        actorUserId: input.actorUserId ?? undefined,
        ipAddress: input.ipAddress ?? undefined,
        userAgent: input.userAgent ?? undefined,
        metadata: input.metadata
          ? (input.metadata as Prisma.InputJsonValue)
          : undefined,
      },
    });
  }
}
