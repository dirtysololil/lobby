import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import {
  callResponseSchema,
  callStateResponseSchema,
  callTokenResponseSchema,
  startDmCallSchema,
  type PublicUser,
  type StartDmCallInput,
} from '@lobby/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireAuth } from '../../common/decorators/require-auth.decorator';
import type { AuthenticatedRequest } from '../../common/interfaces/authenticated-request.interface';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { getRequestMetadata } from '../../common/utils/request-metadata.util';
import { CallsService } from './calls.service';

@Controller('calls')
export class CallsController {
  public constructor(private readonly callsService: CallsService) {}

  @RequireAuth()
  @Get('dm/:conversationId')
  public async getDmCallState(
    @CurrentUser() currentUser: PublicUser,
    @Param('conversationId') conversationId: string,
  ) {
    return callStateResponseSchema.parse(
      await this.callsService.getDmCallState(currentUser.id, conversationId),
    );
  }

  @RequireAuth()
  @Post('dm/:conversationId/start')
  public async startDmCall(
    @CurrentUser() currentUser: PublicUser,
    @Param('conversationId') conversationId: string,
    @Body(new ZodValidationPipe(startDmCallSchema))
    body: StartDmCallInput,
    @Req() request: AuthenticatedRequest,
  ) {
    return callResponseSchema.parse({
      call: await this.callsService.startDmCall(
        currentUser,
        conversationId,
        body,
        getRequestMetadata(request),
      ),
    });
  }

  @RequireAuth()
  @Get('hubs/:hubId/lobbies/:lobbyId')
  public async getLobbyCallState(
    @CurrentUser() currentUser: PublicUser,
    @Param('hubId') hubId: string,
    @Param('lobbyId') lobbyId: string,
  ) {
    return callStateResponseSchema.parse(
      await this.callsService.getLobbyCallState(currentUser.id, hubId, lobbyId),
    );
  }

  @RequireAuth()
  @Post('hubs/:hubId/lobbies/:lobbyId/start')
  public async startLobbyCall(
    @CurrentUser() currentUser: PublicUser,
    @Param('hubId') hubId: string,
    @Param('lobbyId') lobbyId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return callResponseSchema.parse({
      call: await this.callsService.startLobbyCall(
        currentUser,
        hubId,
        lobbyId,
        getRequestMetadata(request),
      ),
    });
  }

  @RequireAuth()
  @Post(':callId/accept')
  public async acceptCall(
    @CurrentUser() currentUser: PublicUser,
    @Param('callId') callId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return callResponseSchema.parse({
      call: await this.callsService.acceptCall(
        currentUser,
        callId,
        getRequestMetadata(request),
      ),
    });
  }

  @RequireAuth()
  @Post(':callId/decline')
  public async declineCall(
    @CurrentUser() currentUser: PublicUser,
    @Param('callId') callId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return callResponseSchema.parse({
      call: await this.callsService.declineCall(
        currentUser,
        callId,
        getRequestMetadata(request),
      ),
    });
  }

  @RequireAuth()
  @Post(':callId/end')
  public async endCall(
    @CurrentUser() currentUser: PublicUser,
    @Param('callId') callId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return callResponseSchema.parse({
      call: await this.callsService.endCall(
        currentUser,
        callId,
        getRequestMetadata(request),
      ),
    });
  }

  @RequireAuth()
  @Post(':callId/token')
  public async issueCallToken(
    @CurrentUser() currentUser: PublicUser,
    @Param('callId') callId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return callTokenResponseSchema.parse(
      await this.callsService.issueCallToken(
        currentUser,
        callId,
        getRequestMetadata(request),
      ),
    );
  }
}
