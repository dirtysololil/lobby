import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import {
  actionMessageSchema,
  adminAuditLogListResponseSchema,
  adminOverviewResponseSchema,
  adminUserSummarySchema,
  adminUserDetailResponseSchema,
  adminUserListResponseSchema,
  inviteListResponseSchema,
  listAdminAuditQuerySchema,
  listAdminUsersQuerySchema,
  platformBlockSchema,
  updateAdminUserRoleSchema,
  type ListAdminAuditQuery,
  type ListAdminUsersQuery,
  type PublicUser,
  type UpdateAdminUserRoleInput,
  type UpsertPlatformBlockInput,
  upsertPlatformBlockSchema,
} from '@lobby/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireAuth } from '../../common/decorators/require-auth.decorator';
import type { AuthenticatedRequest } from '../../common/interfaces/authenticated-request.interface';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { getRequestMetadata } from '../../common/utils/request-metadata.util';
import { AdminService } from './admin.service';

@Controller('admin')
@RequireAuth('OWNER', 'ADMIN')
export class AdminController {
  public constructor(private readonly adminService: AdminService) {}

  @Get('overview')
  public async getOverview() {
    return adminOverviewResponseSchema.parse({
      overview: await this.adminService.getOverview(),
    });
  }

  @Get('users')
  public async listUsers(
    @Query(new ZodValidationPipe(listAdminUsersQuerySchema))
    query: ListAdminUsersQuery,
  ) {
    return adminUserListResponseSchema.parse(
      await this.adminService.listUsers(query),
    );
  }

  @Get('users/:userId')
  public async getUserDetail(@Param('userId') userId: string) {
    return adminUserDetailResponseSchema.parse(
      await this.adminService.getUserDetail(userId),
    );
  }

  @Patch('users/:userId/role')
  public async updateUserRole(
    @CurrentUser() currentUser: PublicUser,
    @Param('userId') userId: string,
    @Body(new ZodValidationPipe(updateAdminUserRoleSchema))
    body: UpdateAdminUserRoleInput,
    @Req() request: AuthenticatedRequest,
  ) {
    return adminUserSummarySchema.parse(
      await this.adminService.updateUserRole(
        currentUser,
        userId,
        body,
        getRequestMetadata(request),
      ),
    );
  }

  @Post('users/:userId/block')
  public async blockUser(
    @CurrentUser() currentUser: PublicUser,
    @Param('userId') userId: string,
    @Body(new ZodValidationPipe(upsertPlatformBlockSchema))
    body: UpsertPlatformBlockInput,
    @Req() request: AuthenticatedRequest,
  ) {
    return platformBlockSchema.parse(
      await this.adminService.blockUser(
        currentUser,
        userId,
        body,
        getRequestMetadata(request),
      ),
    );
  }

  @Post('users/:userId/unblock')
  public async unblockUser(
    @CurrentUser() currentUser: PublicUser,
    @Param('userId') userId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.adminService.unblockUser(
      currentUser,
      userId,
      getRequestMetadata(request),
    );

    return actionMessageSchema.parse({
      ok: true,
    });
  }

  @Get('invites')
  public async listInvites() {
    return inviteListResponseSchema.parse(
      await this.adminService.listInvites(),
    );
  }

  @Get('audit')
  public async listAudit(
    @Query(new ZodValidationPipe(listAdminAuditQuerySchema))
    query: ListAdminAuditQuery,
  ) {
    return adminAuditLogListResponseSchema.parse(
      await this.adminService.listAudit(query),
    );
  }

  @Post('audit/clear')
  public async clearAuditLog(
    @CurrentUser() currentUser: PublicUser,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.adminService.clearAuditLog(
      currentUser,
      getRequestMetadata(request),
    );

    return actionMessageSchema.parse({
      ok: true,
    });
  }
}
