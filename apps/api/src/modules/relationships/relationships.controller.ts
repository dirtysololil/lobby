import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import {
  actionMessageSchema,
  blockActionSchema,
  blockResponseSchema,
  blocksResponseSchema,
  friendshipActionSchema,
  friendshipResponseSchema,
  friendshipsResponseSchema,
  type BlockActionInput,
  type FriendshipActionInput,
  type PublicUser,
} from '@lobby/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireAuth } from '../../common/decorators/require-auth.decorator';
import type { AuthenticatedRequest } from '../../common/interfaces/authenticated-request.interface';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { getRequestMetadata } from '../../common/utils/request-metadata.util';
import { RelationshipsService } from './relationships.service';

@Controller('relationships')
export class RelationshipsController {
  public constructor(
    private readonly relationshipsService: RelationshipsService,
  ) {}

  @RequireAuth()
  @Get('friends')
  public async listFriendships(@CurrentUser() currentUser: PublicUser) {
    const items = await this.relationshipsService.listFriendships(
      currentUser.id,
    );

    return friendshipsResponseSchema.parse({
      items,
    });
  }

  @RequireAuth()
  @Get('blocks')
  public async listBlocks(@CurrentUser() currentUser: PublicUser) {
    const items = await this.relationshipsService.listBlocks(currentUser.id);

    return blocksResponseSchema.parse({
      items,
    });
  }

  @RequireAuth()
  @Post('friends/request')
  public async sendFriendRequest(
    @CurrentUser() currentUser: PublicUser,
    @Body(new ZodValidationPipe(friendshipActionSchema))
    body: FriendshipActionInput,
    @Req() request: AuthenticatedRequest,
  ) {
    const friendship = await this.relationshipsService.sendFriendRequest(
      currentUser,
      body.username,
      getRequestMetadata(request),
    );

    return friendshipResponseSchema.parse({
      friendship,
    });
  }

  @RequireAuth()
  @Post('friends/accept')
  public async acceptFriendRequest(
    @CurrentUser() currentUser: PublicUser,
    @Body(new ZodValidationPipe(friendshipActionSchema))
    body: FriendshipActionInput,
    @Req() request: AuthenticatedRequest,
  ) {
    const friendship = await this.relationshipsService.acceptFriendRequest(
      currentUser,
      body.username,
      getRequestMetadata(request),
    );

    return friendshipResponseSchema.parse({
      friendship,
    });
  }

  @RequireAuth()
  @Post('friends/remove')
  public async removeFriendship(
    @CurrentUser() currentUser: PublicUser,
    @Body(new ZodValidationPipe(friendshipActionSchema))
    body: FriendshipActionInput,
    @Req() request: AuthenticatedRequest,
  ) {
    const friendship = await this.relationshipsService.removeFriendship(
      currentUser,
      body.username,
      getRequestMetadata(request),
    );

    return friendshipResponseSchema.parse({
      friendship,
    });
  }

  @RequireAuth()
  @Post('blocks')
  public async blockUser(
    @CurrentUser() currentUser: PublicUser,
    @Body(new ZodValidationPipe(blockActionSchema)) body: BlockActionInput,
    @Req() request: AuthenticatedRequest,
  ) {
    const block = await this.relationshipsService.blockUser(
      currentUser,
      body.username,
      getRequestMetadata(request),
    );

    return blockResponseSchema.parse({
      block,
    });
  }

  @RequireAuth()
  @Post('blocks/unblock')
  public async unblockUser(
    @CurrentUser() currentUser: PublicUser,
    @Body(new ZodValidationPipe(blockActionSchema)) body: BlockActionInput,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.relationshipsService.unblockUser(
      currentUser,
      body.username,
      getRequestMetadata(request),
    );

    return actionMessageSchema.parse({
      ok: true,
    });
  }
}
