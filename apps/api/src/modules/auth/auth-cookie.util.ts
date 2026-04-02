import type { ApiEnv } from '@lobby/config';
import type { Response } from 'express';

export function setSessionCookie(
  response: Response,
  env: ApiEnv,
  token: string,
  expiresAt: Date,
): void {
  response.cookie(env.SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    domain: env.SESSION_COOKIE_DOMAIN,
    path: '/',
    expires: expiresAt,
  });
}

export function clearSessionCookie(response: Response, env: ApiEnv): void {
  response.clearCookie(env.SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    domain: env.SESSION_COOKIE_DOMAIN,
    path: '/',
  });
}
