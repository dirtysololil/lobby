import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import {
  type PublicUser,
  type UpdateProfileInput,
  type UpdateViewerNotificationDefaultsInput,
  type UsernameSearchInput,
  updateProfileSchema,
  updateViewerNotificationDefaultsSchema,
  userNotificationSettingsResponseSchema,
  userResponseSchema,
  userSearchResponseSchema,
  usernameSearchSchema,
} from '@lobby/shared';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireAuth } from '../../common/decorators/require-auth.decorator';
import type { AuthenticatedRequest } from '../../common/interfaces/authenticated-request.interface';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { getRequestMetadata } from '../../common/utils/request-metadata.util';
import { UsersService } from './users.service';

type UploadedBinaryFile = {
  buffer: Buffer;
  size: number;
  originalname: string;
};

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

  @RequireAuth()
  @Get('me/notification-settings')
  public async getNotificationSettings(@CurrentUser() currentUser: PublicUser) {
    return userNotificationSettingsResponseSchema.parse({
      settings: await this.usersService.getNotificationSettings(currentUser.id),
    });
  }

  @RequireAuth()
  @Patch('me/notification-settings')
  public async updateNotificationSettings(
    @CurrentUser() currentUser: PublicUser,
    @Body(new ZodValidationPipe(updateViewerNotificationDefaultsSchema))
    body: UpdateViewerNotificationDefaultsInput,
    @Req() request: AuthenticatedRequest,
  ) {
    return userNotificationSettingsResponseSchema.parse({
      settings: await this.usersService.updateNotificationDefaults(
        currentUser.id,
        body,
        getRequestMetadata(request),
      ),
    });
  }

  @RequireAuth()
  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('file'))
  public async uploadAvatar(
    @CurrentUser() currentUser: PublicUser,
    @UploadedFile() file: UploadedBinaryFile | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    const user = await this.usersService.uploadAvatar(
      currentUser.id,
      file,
      getRequestMetadata(request),
    );

    return userResponseSchema.parse({
      user,
    });
  }

  @RequireAuth()
  @Delete('me/avatar')
  public async removeAvatar(
    @CurrentUser() currentUser: PublicUser,
    @Req() request: AuthenticatedRequest,
  ) {
    const user = await this.usersService.removeAvatar(
      currentUser.id,
      getRequestMetadata(request),
    );

    return userResponseSchema.parse({
      user,
    });
  }

  @RequireAuth()
  @Post('me/ringtone')
  @UseInterceptors(FileInterceptor('file'))
  public async uploadRingtone(
    @CurrentUser() currentUser: PublicUser,
    @UploadedFile() file: UploadedBinaryFile | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    const user = await this.usersService.uploadRingtone(
      currentUser.id,
      file,
      getRequestMetadata(request),
    );

    return userResponseSchema.parse({
      user,
    });
  }

  @RequireAuth()
  @Delete('me/ringtone')
  public async removeRingtone(
    @CurrentUser() currentUser: PublicUser,
    @Req() request: AuthenticatedRequest,
  ) {
    const user = await this.usersService.removeRingtone(
      currentUser.id,
      getRequestMetadata(request),
    );

    return userResponseSchema.parse({
      user,
    });
  }

  @RequireAuth()
  @Get('me/ringtone')
  public async streamCustomRingtone(
    @CurrentUser() currentUser: PublicUser,
    @Res() response: Response,
  ) {
    const asset = await this.usersService.getCustomRingtoneAsset(
      currentUser.id,
    );
    response.setHeader('Content-Type', asset.mimeType);
    response.setHeader('Cache-Control', 'private, max-age=300');

    return response.send(asset.buffer);
  }

  @RequireAuth()
  @Get(':userId/avatar')
  public async streamAvatar(
    @Param('userId') userId: string,
    @Res() response: Response,
    @Req() _request: AuthenticatedRequest,
  ) {
    void _request;

    const asset = await this.usersService.getAvatarAsset(userId);
    response.setHeader('Content-Type', asset.mimeType);
    response.setHeader('Cache-Control', 'private, max-age=300');

    return response.send(asset.buffer);
  }
}
