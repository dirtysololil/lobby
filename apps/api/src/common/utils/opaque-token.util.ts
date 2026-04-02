import { createHash, randomBytes } from 'crypto';

type HashPurpose = 'invite' | 'session';

export function hashOpaqueToken(
  token: string,
  secret: string,
  purpose: HashPurpose,
): string {
  return createHash('sha256')
    .update(`${purpose}:${secret}:${token}`)
    .digest('hex');
}

export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function generateAccessKey(): string {
  const segments = Array.from({ length: 3 }, () =>
    randomBytes(4).toString('hex').toUpperCase(),
  );
  return `LBY-${segments.join('-')}`;
}
