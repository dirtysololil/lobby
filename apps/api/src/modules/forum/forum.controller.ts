import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import {
  createForumReplySchema,
  createForumTopicSchema,
  forumReplyResponseSchema,
  forumTopicDetailSchema,
  forumTopicListResponseSchema,
  forumTopicResponseSchema,
  updateForumTopicStateSchema,
  type CreateForumReplyInput,
  type CreateForumTopicInput,
  type PublicUser,
  type UpdateForumTopicStateInput,
} from '@lobby/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireAuth } from '../../common/decorators/require-auth.decorator';
import type { AuthenticatedRequest } from '../../common/interfaces/authenticated-request.interface';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { getRequestMetadata } from '../../common/utils/request-metadata.util';
import { ForumService } from './forum.service';

@Controller('forum')
export class ForumController {
  public constructor(private readonly forumService: ForumService) {}

  @RequireAuth()
  @Get('hubs/:hubId/lobbies/:lobbyId/topics')
  public async listTopics(
    @CurrentUser() currentUser: PublicUser,
    @Param('hubId') hubId: string,
    @Param('lobbyId') lobbyId: string,
  ) {
    const items = await this.forumService.listTopics(
      currentUser.id,
      hubId,
      lobbyId,
    );

    return forumTopicListResponseSchema.parse({
      items,
    });
  }

  @RequireAuth()
  @Post('hubs/:hubId/lobbies/:lobbyId/topics')
  public async createTopic(
    @CurrentUser() currentUser: PublicUser,
    @Param('hubId') hubId: string,
    @Param('lobbyId') lobbyId: string,
    @Body(new ZodValidationPipe(createForumTopicSchema))
    body: CreateForumTopicInput,
    @Req() request: AuthenticatedRequest,
  ) {
    const topic = await this.forumService.createTopic(
      currentUser,
      hubId,
      lobbyId,
      body,
      getRequestMetadata(request),
    );

    return forumTopicResponseSchema.parse({
      topic,
    });
  }

  @RequireAuth()
  @Get('hubs/:hubId/lobbies/:lobbyId/topics/:topicId')
  public async getTopicDetail(
    @CurrentUser() currentUser: PublicUser,
    @Param('hubId') hubId: string,
    @Param('lobbyId') lobbyId: string,
    @Param('topicId') topicId: string,
  ) {
    return forumTopicDetailSchema.parse(
      await this.forumService.getTopicDetail(
        currentUser.id,
        hubId,
        lobbyId,
        topicId,
      ),
    );
  }

  @RequireAuth()
  @Post('hubs/:hubId/lobbies/:lobbyId/topics/:topicId/replies')
  public async createReply(
    @CurrentUser() currentUser: PublicUser,
    @Param('hubId') hubId: string,
    @Param('lobbyId') lobbyId: string,
    @Param('topicId') topicId: string,
    @Body(new ZodValidationPipe(createForumReplySchema))
    body: CreateForumReplyInput,
    @Req() request: AuthenticatedRequest,
  ) {
    const reply = await this.forumService.createReply(
      currentUser,
      hubId,
      lobbyId,
      topicId,
      body,
      getRequestMetadata(request),
    );

    return forumReplyResponseSchema.parse({
      reply,
    });
  }

  @RequireAuth()
  @Patch('hubs/:hubId/lobbies/:lobbyId/topics/:topicId/state')
  public async updateTopicState(
    @CurrentUser() currentUser: PublicUser,
    @Param('hubId') hubId: string,
    @Param('lobbyId') lobbyId: string,
    @Param('topicId') topicId: string,
    @Body(new ZodValidationPipe(updateForumTopicStateSchema))
    body: UpdateForumTopicStateInput,
    @Req() request: AuthenticatedRequest,
  ) {
    const topic = await this.forumService.updateTopicState(
      currentUser,
      hubId,
      lobbyId,
      topicId,
      body,
      getRequestMetadata(request),
    );

    return forumTopicResponseSchema.parse({
      topic,
    });
  }
}
