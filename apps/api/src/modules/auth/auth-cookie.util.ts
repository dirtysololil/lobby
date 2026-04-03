import type { ApiEnv } from '@lobby/config';
import type { Response } from 'express';

export function setSessionCookie(
  response: Response,
  env: ApiEnv,
  token: string,
  expiresAt: Date,
): void {
  const cookieDomain = resolveSessionCookieDomain(env);

  console.info(
    `[auth/cookie] set cookieName=${env.SESSION_COOKIE_NAME} domain=${cookieDomain ?? 'host-only'} secure=${env.NODE_ENV === 'production'}`,
  );

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

  console.info(
    `[auth/cookie] clear cookieName=${env.SESSION_COOKIE_NAME} domain=${cookieDomain ?? 'host-only'}`,
  );

  response.clearCookie(env.SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    domain: cookieDomain,
    path: '/',
  });
}

function resolveSessionCookieDomain(env: ApiEnv): string | undefined {
  const rawDomain = env.SESSION_COOKIE_DOMAIN?.trim();
  const hostname =
    parseDomainHostname(rawDomain) ?? parseDomainHostname(env.WEB_PUBLIC_URL);

  if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1') {
    return undefined;
  }

  return hostname.startsWith('.') ? hostname : `.${hostname}`;
}

function parseDomainHostname(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  if (value.includes('://')) {
    try {
      return new URL(value).hostname;
    } catch {
      return undefined;
    }
  }

  const withoutPath = value.split('/')[0];

  if (!withoutPath) {
    return undefined;
  }

  const withoutPort = withoutPath.split(':')[0];
  return withoutPort || undefined;
}
