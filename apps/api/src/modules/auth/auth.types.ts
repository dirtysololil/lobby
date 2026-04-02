import type { PublicUser } from '@lobby/shared';

export interface ResolvedSession {
  sessionId: string;
  user: PublicUser;
}
