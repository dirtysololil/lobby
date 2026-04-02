import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@lobby/shared';

export const ROLES_METADATA_KEY = 'roles';

export function Roles(...roles: UserRole[]) {
  return SetMetadata(ROLES_METADATA_KEY, roles);
}
