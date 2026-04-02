import { applyDecorators, UseGuards } from '@nestjs/common';
import type { UserRole } from '@lobby/shared';
import { Roles } from './roles.decorator';
import { AuthenticatedGuard } from '../guards/authenticated.guard';
import { RolesGuard } from '../guards/roles.guard';

export function RequireAuth(...roles: UserRole[]) {
  return applyDecorators(
    Roles(...roles),
    UseGuards(AuthenticatedGuard, RolesGuard),
  );
}
