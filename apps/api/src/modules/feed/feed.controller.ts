import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import {
  createFeedPostSchema,
  feedPostListResponseSchema,
  feedPostResponseSchema,
  type CreateFeedPostInput,
  type PublicUser,
} from '@lobby/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireAuth } from '../../common/decorators/require-auth.decorator';
import type { AuthenticatedRequest } from '../../common/interfaces/authenticated-request.interface';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { getRequestMetadata } from '../../common/utils/request-metadata.util';
import { FeedService } from './feed.service';

@Controller('feed')
export class FeedController {
  public constructor(private readonly feedService: FeedService) {}

  @RequireAuth()
  @Get()
  public async listPosts() {
    return feedPostListResponseSchema.parse({
      items: await this.feedService.listPosts(),
    });
  }

  @RequireAuth()
  @Post()
  public async createPost(
    @CurrentUser() currentUser: PublicUser,
    @Body(new ZodValidationPipe(createFeedPostSchema))
    body: CreateFeedPostInput,
    @Req() request: AuthenticatedRequest,
  ) {
    return feedPostResponseSchema.parse({
      post: await this.feedService.createPost(
        currentUser,
        body,
        getRequestMetadata(request),
      ),
    });
  }
}
