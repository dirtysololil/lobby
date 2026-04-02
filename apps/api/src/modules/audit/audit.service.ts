import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { publicUserSelect } from '../auth/auth.mapper';

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

  public async list(input: {
    action?: string;
    entityType?: string;
    page: number;
    pageSize: number;
  }) {
    const where: Prisma.AuditLogWhereInput = {
      ...(input.action
        ? {
            action: {
              contains: input.action,
              mode: 'insensitive',
            },
          }
        : {}),
      ...(input.entityType
        ? {
            entityType: {
              equals: input.entityType,
              mode: 'insensitive',
            },
          }
        : {}),
    };
    const skip = (input.page - 1) * input.pageSize;
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          actorUser: {
            select: publicUserSelect,
          },
        },
        skip,
        take: input.pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items,
      total,
    };
  }
}
