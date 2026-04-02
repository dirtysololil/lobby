import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import {
  actionMessageSchema,
  createHubBanSchema,
  createHubInviteSchema,
  createHubSchema,
  createHubMuteSchema,
  createLobbySchema,
  hubInviteResponseSchema,
  hubNotificationSettingResponseSchema,
  hubListResponseSchema,
  hubShellResponseSchema,
  hubSummarySchema,
  lobbyResponseSchema,
  lobbyNotificationSettingResponseSchema,
  updateHubMemberRoleSchema,
  updateHubNotificationSettingSchema,
  updateLobbyAccessSchema,
  updateLobbyNotificationSettingSchema,
  userTargetActionSchema,
  viewerHubInvitesResponseSchema,
  type CreateHubBanInput,
  type CreateHubInput,
  type CreateHubInviteInput,
  type CreateHubMuteInput,
  type CreateLobbyInput,
  type PublicUser,
  type UpdateHubMemberRoleInput,
  type UpdateHubNotificationSettingInput,
  type UpdateLobbyAccessInput,
  type UpdateLobbyNotificationSettingInput,
  type UserTargetActionInput,
} from '@lobby/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireAuth } from '../../common/decorators/require-auth.decorator';
import type { AuthenticatedRequest } from '../../common/interfaces/authenticated-request.interface';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { getRequestMetadata } from '../../common/utils/request-metadata.util';
import { HubsService } from './hubs.service';

@Controller('hubs')
export class HubsController {
  public constructor(private readonly hubsService: HubsService) {}

  @RequireAuth()
  @Get()
  public async listViewerHubs(@CurrentUser() currentUser: PublicUser) {
    const items = await this.hubsService.listViewerHubs(currentUser.id);

    return hubListResponseSchema.parse({
      items,
    });
  }

  @RequireAuth()
  @Get('invites/me')
  public async listViewerInvites(@CurrentUser() currentUser: PublicUser) {
    const items = await this.hubsService.listViewerPendingInvites(
      currentUser.id,
    );

    return viewerHubInvitesResponseSchema.parse({
      items,
    });
  }

  @RequireAuth()
  @Post()
  public async createHub(
    @CurrentUser() currentUser: PublicUser,
    @Body(new ZodValidationPipe(createHubSchema)) body: CreateHubInput,
    @Req() request: AuthenticatedRequest,
  ) {
    const hub = await this.hubsService.createHub(
      currentUser,
      body,
      getRequestMetadata(request),
    );

    return hubSummarySchema.parse(hub);
  }

  @RequireAuth()
  @Get(':hubId')
  public async getHubShell(
    @CurrentUser() currentUser: PublicUser,
    @Param('hubId') hubId: string,
  ) {
    return hubShellResponseSchema.parse(
      await this.hubsService.getHubShell(currentUser.id, hubId),
    );
  }

  @RequireAuth()
  @Post(':hubId/lobbies')
  public async createLobby(
    @CurrentUser() currentUser: PublicUser,
    @Param('hubId') hubId: string,
    @Body(new ZodValidationPipe(createLobbySchema)) body: CreateLobbyInput,
    @Req() request: AuthenticatedRequest,
  ) {
    const lobby = await this.hubsService.createLobby(
      currentUser,
      hubId,
      body,
      getRequestMetadata(request),
    );

    return lobbyResponseSchema.parse({
      lobby,
    });
  }

  @RequireAuth()
  @Patch(':hubId/lobbies/:lobbyId/access')
  public async updatePrivateLobbyAccess(
    @CurrentUser() currentUser: PublicUser,
    @Param('hubId') hubId: string,
    @Param('lobbyId') lobbyId: string,
    @Body(new ZodValidationPipe(updateLobbyAccessSchema))
    body: UpdateLobbyAccessInput,
    @Req() request: AuthenticatedRequest,
  ) {
    const lobby = await this.hubsService.updatePrivateLobbyAccess(
      currentUser,
      hubId,
      lobbyId,
      body.allowedUsernames,
      getRequestMetadata(request),
    );

    return lobbyResponseSchema.parse({
      lobby,
    });
  }

  @RequireAuth()
  @Patch(':hubId/notification-settings')
  public async updateHubNotificationSetting(
    @CurrentUser() currentUser: PublicUser,
    @Param('hubId') hubId: string,
    @Body(new ZodValidationPipe(updateHubNotificationSettingSchema))
    body: UpdateHubNotificationSettingInput,
    @Req() request: AuthenticatedRequest,
  ) {
    return hubNotificationSettingResponseSchema.parse(
      await this.hubsService.updateHubNotificationSetting(
        currentUser,
        hubId,
        body,
        getRequestMetadata(request),
      ),
    );
  }

  @RequireAuth()
  @Patch(':hubId/lobbies/:lobbyId/notification-settings')
  public async updateLobbyNotificationSetting(
    @CurrentUser() currentUser: PublicUser,
    @Param('hubId') hubId: string,
    @Param('lobbyId') lobbyId: string,
    @Body(new ZodValidationPipe(updateLobbyNotificationSettingSchema))
    body: UpdateLobbyNotificationSettingInput,
    @Req() request: AuthenticatedRequest,
  ) {
    return lobbyNotificationSettingResponseSchema.parse(
      await this.hubsService.updateLobbyNotificationSetting(
        currentUser,
        hubId,
        lobbyId,
        body,
        getRequestMetadata(request),
      ),
    );
  }

  @RequireAuth()
  @Post(':hubId/invites')
  public async createHubInvite(
    @CurrentUser() currentUser: PublicUser,
    @Param('hubId') hubId: string,
    @Body(new ZodValidationPipe(createHubInviteSchema))
    body: CreateHubInviteInput,
    @Req() request: AuthenticatedRequest,
  ) {
    const invite = await this.hubsService.createHubInvite(
      currentUser,
      hubId,
      body,
      getRequestMetadata(request),
    );

    return hubInviteResponseSchema.parse({
      invite,
    });
  }

  @RequireAuth()
  @Post('invites/:inviteId/accept')
  public async acceptHubInvite(
    @CurrentUser() currentUser: PublicUser,
    @Param('inviteId') inviteId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.hubsService.acceptHubInvite(
      currentUser,
      inviteId,
      getRequestMetadata(request),
    );

    return actionMessageSchema.parse({
      ok: true,
    });
  }

  @RequireAuth()
  @Post('invites/:inviteId/decline')
  public async declineHubInvite(
    @CurrentUser() currentUser: PublicUser,
    @Param('inviteId') inviteId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.hubsService.declineHubInvite(
      currentUser,
      inviteId,
      getRequestMetadata(request),
    );

    return actionMessageSchema.parse({
      ok: true,
    });
  }

  @RequireAuth()
  @Patch(':hubId/members/role')
  public async updateMemberRole(
    @CurrentUser() currentUser: PublicUser,
    @Param('hubId') hubId: string,
    @Body(new ZodValidationPipe(updateHubMemberRoleSchema))
    body: UpdateHubMemberRoleInput,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.hubsService.updateMemberRole(
      currentUser,
      hubId,
      body,
      getRequestMetadata(request),
    );

    return actionMessageSchema.parse({
      ok: true,
    });
  }

  @RequireAuth()
  @Post(':hubId/members/kick')
  public async kickMember(
    @CurrentUser() currentUser: PublicUser,
    @Param('hubId') hubId: string,
    @Body(new ZodValidationPipe(userTargetActionSchema))
    body: UserTargetActionInput,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.hubsService.kickMember(
      currentUser,
      hubId,
      body,
      getRequestMetadata(request),
    );

    return actionMessageSchema.parse({
      ok: true,
    });
  }

  @RequireAuth()
  @Post(':hubId/bans')
  public async banMember(
    @CurrentUser() currentUser: PublicUser,
    @Param('hubId') hubId: string,
    @Body(new ZodValidationPipe(createHubBanSchema))
    body: CreateHubBanInput,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.hubsService.banMember(
      currentUser,
      hubId,
      body,
      getRequestMetadata(request),
    );

    return actionMessageSchema.parse({
      ok: true,
    });
  }

  @RequireAuth()
  @Post(':hubId/bans/revoke')
  public async unbanMember(
    @CurrentUser() currentUser: PublicUser,
    @Param('hubId') hubId: string,
    @Body(new ZodValidationPipe(userTargetActionSchema))
    body: UserTargetActionInput,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.hubsService.unbanMember(
      currentUser,
      hubId,
      body,
      getRequestMetadata(request),
    );

    return actionMessageSchema.parse({
      ok: true,
    });
  }

  @RequireAuth()
  @Post(':hubId/mutes')
  public async muteMember(
    @CurrentUser() currentUser: PublicUser,
    @Param('hubId') hubId: string,
    @Body(new ZodValidationPipe(createHubMuteSchema))
    body: CreateHubMuteInput,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.hubsService.muteMember(
      currentUser,
      hubId,
      body,
      getRequestMetadata(request),
    );

    return actionMessageSchema.parse({
      ok: true,
    });
  }

  @RequireAuth()
  @Post(':hubId/mutes/revoke')
  public async unmuteMember(
    @CurrentUser() currentUser: PublicUser,
    @Param('hubId') hubId: string,
    @Body(new ZodValidationPipe(userTargetActionSchema))
    body: UserTargetActionInput,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.hubsService.unmuteMember(
      currentUser,
      hubId,
      body,
      getRequestMetadata(request),
    );

    return actionMessageSchema.parse({
      ok: true,
    });
  }
}
