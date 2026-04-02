import { Body, Controller, Get, Patch, Query, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  updateProfileSchema,
  userSearchResponseSchema,
  userResponseSchema,
  usernameSearchSchema,
  type PublicUser,
  type UpdateProfileInput,
  type UsernameSearchInput,
} from '@lobby/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireAuth } from '../../common/decorators/require-auth.decorator';
import type { AuthenticatedRequest } from '../../common/interfaces/authenticated-request.interface';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { getRequestMetadata } from '../../common/utils/request-metadata.util';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  public constructor(private readonly usersService: UsersService) {}

  @RequireAuth()
  @Get('me')
  public async getMe(@CurrentUser() currentUser: PublicUser) {
    const user = await this.usersService.getViewer(currentUser.id);

    return userResponseSchema.parse({
      user,
    });
  }

  @RequireAuth()
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  @Get('search')
  public async searchUsers(
    @CurrentUser() currentUser: PublicUser,
    @Query(new ZodValidationPipe(usernameSearchSchema))
    query: UsernameSearchInput,
  ) {
    const items = await this.usersService.searchUsers(
      currentUser.id,
      query.query,
    );

    return userSearchResponseSchema.parse({
      items,
    });
  }

  @RequireAuth()
  @Patch('me/profile')
  public async updateProfile(
    @CurrentUser() currentUser: PublicUser,
    @Body(new ZodValidationPipe(updateProfileSchema)) body: UpdateProfileInput,
    @Req() request: AuthenticatedRequest,
  ) {
    const user = await this.usersService.updateProfile(
      currentUser.id,
      body,
      getRequestMetadata(request),
    );

    return userResponseSchema.parse({
      user,
    });
  }
}
