import type { ApiEnv } from '@lobby/config';
import type { Response } from 'express';

export function setSessionCookie(
  response: Response,
  env: ApiEnv,
  token: string,
  expiresAt: Date,
): void {
  const cookieDomain = resolveSessionCookieDomain(env);

  response.cookie(env.SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    domain: cookieDomain,
    path: '/',
    expires: expiresAt,
  });
}

export function clearSessionCookie(response: Response, env: ApiEnv): void {
  const cookieDomain = resolveSessionCookieDomain(env);

  response.clearCookie(env.SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    domain: cookieDomain,
    path: '/',
  });
}

function resolveSessionCookieDomain(env: ApiEnv): string | undefined {
  if (env.SESSION_COOKIE_DOMAIN) {
    return env.SESSION_COOKIE_DOMAIN;
  }

  try {
    const hostname = new URL(env.WEB_PUBLIC_URL).hostname;

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return undefined;
    }

    return hostname;
  } catch {
    return undefined;
  }
}
