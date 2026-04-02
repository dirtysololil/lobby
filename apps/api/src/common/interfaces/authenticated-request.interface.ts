import type { PublicUser } from '@lobby/shared';
import type { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  authSession?: {
    sessionId: string;
    userId: string;
    rawToken: string;
  };
  currentUser?: PublicUser;
}
