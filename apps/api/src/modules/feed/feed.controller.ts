import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  createFeedPostSchema,
  feedPostListResponseSchema,
  feedPostResponseSchema,
  reactionMutationSchema,
  type CreateFeedPostInput,
  type PublicUser,
  type ReactionMutationInput,
} from '@lobby/shared';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireAuth } from '../../common/decorators/require-auth.decorator';
import type { AuthenticatedRequest } from '../../common/interfaces/authenticated-request.interface';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { getRequestMetadata } from '../../common/utils/request-metadata.util';
import { FeedService } from './feed.service';

type UploadedBinaryFile = {
  buffer: Buffer;
  size: number;
  originalname: string;
  mimetype?: string;
};

@Controller('feed')
export class FeedController {
  public constructor(private readonly feedService: FeedService) {}

  @RequireAuth()
  @Get()
  public async listPosts(@CurrentUser() currentUser: PublicUser) {
    return feedPostListResponseSchema.parse({
      items: await this.feedService.listPosts(currentUser.id),
    });
  }

  @RequireAuth()
  @Post('media')
  @UseInterceptors(FileInterceptor('file'))
  public async uploadMedia(
    @UploadedFile() file: UploadedBinaryFile | undefined,
  ) {
    return this.feedService.uploadPostMedia(file);
  }

  @RequireAuth()
  @Get('media/:mediaKey')
  public async streamMedia(
    @Param('mediaKey') mediaKey: string,
    @Res() response: Response,
  ) {
    const media = await this.feedService.readPostMedia(mediaKey);

    response.setHeader('Content-Type', media.mimeType);
    response.setHeader('Cache-Control', 'private, max-age=31536000, immutable');

    return response.send(media.buffer);
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

  @RequireAuth()
  @Post(':postId/reactions')
  public async toggleReaction(
    @CurrentUser() currentUser: PublicUser,
    @Param('postId') postId: string,
    @Body(new ZodValidationPipe(reactionMutationSchema))
    body: ReactionMutationInput,
    @Req() request: AuthenticatedRequest,
  ) {
    return feedPostResponseSchema.parse({
      post: await this.feedService.toggleReaction(
        currentUser,
        postId,
        body,
        getRequestMetadata(request),
      ),
    });
  }
}
