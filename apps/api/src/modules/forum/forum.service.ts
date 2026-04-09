import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreateForumReplyInput,
  CreateForumTopicInput,
  ForumTopicDetail,
  ForumTopicResponse,
  UpdateForumTopicStateInput,
  PublicUser,
} from '@lobby/shared';
import { LobbyType, Prisma } from '@prisma/client';
import type { RequestMetadata } from '../../common/interfaces/request-metadata.interface';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { publicUserSelect } from '../auth/auth.mapper';
import { HubsService } from '../hubs/hubs.service';
import { toForumReply, toForumTopic } from './forum.mapper';

const forumTopicInclude = {
  author: {
    select: publicUserSelect,
  },
  tags: {
    include: {
      tag: true,
    },
  },
  _count: {
    select: {
      replies: true,
    },
  },
} satisfies Prisma.ForumTopicInclude;

const forumReplyInclude = {
  author: {
    select: publicUserSelect,
  },
} satisfies Prisma.ForumReplyInclude;

@Injectable()
export class ForumService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly hubsService: HubsService,
  ) {}

  public async listTopics(viewerId: string, hubId: string, lobbyId: string) {
    const lobby = await this.hubsService.getAccessibleLobbyOrThrow(
      viewerId,
      hubId,
      lobbyId,
    );

    if (lobby.type !== LobbyType.FORUM && lobby.type !== LobbyType.TEXT) {
      throw new ConflictException('Lobby does not support discussion feed');
    }

    const topics = await this.prisma.forumTopic.findMany({
      where: {
        hubId,
        lobbyId,
      },
      include: forumTopicInclude,
      orderBy:
        lobby.type === LobbyType.TEXT
          ? [
              {
                createdAt: 'asc',
              },
            ]
          : [
              {
                pinned: 'desc',
              },
              {
                lastActivityAt: 'desc',
              },
            ],
    });

    return topics.map((topic) => toForumTopic(topic));
  }

  public async createTopic(
    actor: PublicUser,
    hubId: string,
    lobbyId: string,
    input: CreateForumTopicInput,
    requestMetadata: RequestMetadata,
  ): Promise<ForumTopicResponse['topic']> {
    const lobby = await this.hubsService.getAccessibleLobbyOrThrow(
      actor.id,
      hubId,
      lobbyId,
    );
    await this.hubsService.assertCanCreateForumContent(
      actor.id,
      hubId,
      lobbyId,
    );

    if (lobby.type !== LobbyType.FORUM && lobby.type !== LobbyType.TEXT) {
      throw new ConflictException('Lobby does not support discussion feed');
    }

    const topic = await this.prisma.$transaction(async (transaction) => {
      const createdTopic = await transaction.forumTopic.create({
        data: {
          hubId,
          lobbyId,
          authorId: actor.id,
          title: input.title.trim(),
          content: input.content.trim(),
        },
        include: forumTopicInclude,
      });

      const normalizedTags = [
        ...new Set(input.tags.map((tag) => this.normalizeTag(tag))),
      ];

      for (const slug of normalizedTags) {
        const tag = await transaction.forumTag.upsert({
          where: {
            hubId_slug: {
              hubId,
              slug,
            },
          },
          create: {
            hubId,
            name: slug,
            slug,
          },
          update: {
            name: slug,
          },
        });

        await transaction.forumTopicTag.create({
          data: {
            topicId: createdTopic.id,
            tagId: tag.id,
          },
        });
      }

      return transaction.forumTopic.findUniqueOrThrow({
        where: {
          id: createdTopic.id,
        },
        include: forumTopicInclude,
      });
    });

    await this.auditService.write({
      action: 'forum.topic.create',
      entityType: 'ForumTopic',
      entityId: topic.id,
      actorUserId: actor.id,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      metadata: {
        hubId,
        lobbyId,
      },
    });

    return toForumTopic(topic);
  }

  public async getTopicDetail(
    viewerId: string,
    hubId: string,
    lobbyId: string,
    topicId: string,
  ): Promise<ForumTopicDetail> {
    const lobby = await this.hubsService.getAccessibleLobbyOrThrow(
      viewerId,
      hubId,
      lobbyId,
    );

    if (lobby.type !== LobbyType.FORUM) {
      throw new ConflictException('Lobby is not a forum lobby');
    }

    const topic = await this.prisma.forumTopic.findFirst({
      where: {
        id: topicId,
        hubId,
        lobbyId,
      },
      include: {
        ...forumTopicInclude,
        replies: {
          include: forumReplyInclude,
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!topic) {
      throw new NotFoundException('Forum topic not found');
    }

    return {
      topic: {
        ...toForumTopic(topic),
        replies: topic.replies.map((reply) => toForumReply(reply)),
      },
    };
  }

  public async createReply(
    actor: PublicUser,
    hubId: string,
    lobbyId: string,
    topicId: string,
    input: CreateForumReplyInput,
    requestMetadata: RequestMetadata,
  ) {
    const lobby = await this.hubsService.getAccessibleLobbyOrThrow(
      actor.id,
      hubId,
      lobbyId,
    );
    await this.hubsService.assertCanCreateForumContent(
      actor.id,
      hubId,
      lobbyId,
    );

    if (lobby.type !== LobbyType.FORUM) {
      throw new ConflictException(
        'Lobby does not support threaded discussions',
      );
    }

    const topic = await this.prisma.forumTopic.findFirst({
      where: {
        id: topicId,
        hubId,
        lobbyId,
      },
      select: {
        id: true,
        locked: true,
        archived: true,
      },
    });

    if (!topic) {
      throw new NotFoundException('Forum topic not found');
    }

    if (topic.locked || topic.archived) {
      throw new ForbiddenException('Replies are disabled for this topic');
    }

    const reply = await this.prisma.$transaction(async (transaction) => {
      const createdReply = await transaction.forumReply.create({
        data: {
          topicId,
          authorId: actor.id,
          content: input.content.trim(),
        },
        include: forumReplyInclude,
      });

      await transaction.forumTopic.update({
        where: {
          id: topicId,
        },
        data: {
          lastActivityAt: createdReply.createdAt,
        },
      });

      return createdReply;
    });

    await this.auditService.write({
      action: 'forum.reply.create',
      entityType: 'ForumReply',
      entityId: reply.id,
      actorUserId: actor.id,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      metadata: {
        hubId,
        lobbyId,
        topicId,
      },
    });

    return toForumReply(reply);
  }

  public async updateTopicState(
    actor: PublicUser,
    hubId: string,
    lobbyId: string,
    topicId: string,
    input: UpdateForumTopicStateInput,
    requestMetadata: RequestMetadata,
  ) {
    await this.hubsService.assertCanModerateForum(actor.id, hubId);
    const lobby = await this.hubsService.getAccessibleLobbyOrThrow(
      actor.id,
      hubId,
      lobbyId,
    );

    if (lobby.type !== LobbyType.FORUM) {
      throw new ConflictException(
        'Lobby does not support threaded discussions',
      );
    }

    if (
      input.pinned === undefined &&
      input.locked === undefined &&
      input.archived === undefined
    ) {
      throw new ConflictException('No topic state changes were provided');
    }

    const topic = await this.prisma.forumTopic.findFirst({
      where: {
        id: topicId,
        hubId,
        lobbyId,
      },
      include: forumTopicInclude,
    });

    if (!topic) {
      throw new NotFoundException('Forum topic not found');
    }

    const updatedTopic = await this.prisma.forumTopic.update({
      where: {
        id: topicId,
      },
      data: {
        pinned: input.pinned,
        locked: input.locked,
        archived: input.archived,
      },
      include: forumTopicInclude,
    });

    await this.auditService.write({
      action: 'forum.topic.state.update',
      entityType: 'ForumTopic',
      entityId: topicId,
      actorUserId: actor.id,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      metadata: {
        hubId,
        lobbyId,
        pinned: input.pinned ?? topic.pinned,
        locked: input.locked ?? topic.locked,
        archived: input.archived ?? topic.archived,
      },
    });

    return toForumTopic(updatedTopic);
  }

  private normalizeTag(tag: string): string {
    return tag
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
