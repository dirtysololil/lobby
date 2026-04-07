import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  createInviteSchema,
  inviteCreateResponseSchema,
  inviteListResponseSchema,
  inviteLookupQuerySchema,
  inviteLookupResponseSchema,
  inviteResponseSchema,
  updateInviteSchema,
  type CreateInviteInput,
  type InviteLookupQuery,
  type PublicUser,
  type UpdateInviteInput,
} from '@lobby/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireAuth } from '../../common/decorators/require-auth.decorator';
import type { AuthenticatedRequest } from '../../common/interfaces/authenticated-request.interface';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { getRequestMetadata } from '../../common/utils/request-metadata.util';
import { InvitesService } from './invites.service';

@Controller('invites')
export class InvitesController {
  public constructor(private readonly invitesService: InvitesService) {}

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get('resolve')
  public async lookupInvite(
    @Query(new ZodValidationPipe(inviteLookupQuerySchema))
    query: InviteLookupQuery,
  ) {
    return inviteLookupResponseSchema.parse(
      await this.invitesService.lookupInvite(query.invite),
    );
  }

  @RequireAuth('OWNER', 'ADMIN')
  @Get()
  public async listInvites() {
    const items = await this.invitesService.listInvites();

    return inviteListResponseSchema.parse({
      items,
    });
  }

  @RequireAuth('OWNER', 'ADMIN')
  @Get(':inviteId')
  public async getInvite(@Param('inviteId') inviteId: string) {
    const invite = await this.invitesService.getInvite(inviteId);

    return inviteResponseSchema.parse({
      invite,
    });
  }

  @RequireAuth('OWNER', 'ADMIN')
  @Post()
  public async createInvite(
    @CurrentUser() currentUser: PublicUser,
    @Body(new ZodValidationPipe(createInviteSchema)) body: CreateInviteInput,
    @Req() request: AuthenticatedRequest,
  ) {
    const result = await this.invitesService.createInvite(
      currentUser,
      body,
      getRequestMetadata(request),
    );

    return inviteCreateResponseSchema.parse(result);
  }

  @RequireAuth('OWNER', 'ADMIN')
  @Patch(':inviteId')
  public async updateInvite(
    @CurrentUser() currentUser: PublicUser,
    @Param('inviteId') inviteId: string,
    @Body(new ZodValidationPipe(updateInviteSchema)) body: UpdateInviteInput,
    @Req() request: AuthenticatedRequest,
  ) {
    const invite = await this.invitesService.updateInvite(
      currentUser,
      inviteId,
      body,
      getRequestMetadata(request),
    );

    return inviteResponseSchema.parse({
      invite,
    });
  }

  @RequireAuth('OWNER', 'ADMIN')
  @Post(':inviteId/revoke')
  public async revokeInvite(
    @CurrentUser() currentUser: PublicUser,
    @Param('inviteId') inviteId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    const invite = await this.invitesService.revokeInvite(
      currentUser,
      inviteId,
      getRequestMetadata(request),
    );

    return inviteResponseSchema.parse({
      invite,
    });
  }
}
