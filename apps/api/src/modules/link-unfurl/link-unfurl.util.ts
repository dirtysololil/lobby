import { createHash } from 'node:crypto';

const urlPattern = /https?:\/\/[^\s<>"'`]+/giu;

export interface LinkUnfurlCandidate {
  provider: 'TENOR';
  sourceUrl: string;
}

const supportedHosts = ['tenor.com', 'tenor.co'] as const;

export function extractFirstSupportedLink(
  text: string | null | undefined,
): LinkUnfurlCandidate | null {
  if (!text) {
    return null;
  }

  for (const match of text.matchAll(urlPattern)) {
    const rawUrl = sanitizeDetectedUrl(match[0]);

    if (!rawUrl) {
      continue;
    }

    const candidate = toSupportedCandidate(rawUrl);

    if (candidate) {
      return candidate;
    }
  }

  return null;
}

export function toSupportedCandidate(
  rawUrl: string,
): LinkUnfurlCandidate | null {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    return null;
  }

  if (!isSupportedTenorHost(parsedUrl.hostname)) {
    return null;
  }

  if (!/^https?:$/i.test(parsedUrl.protocol)) {
    return null;
  }

  parsedUrl.hash = '';

  return {
    provider: 'TENOR',
    sourceUrl: parsedUrl.toString(),
  };
}

export function createUrlHash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function isSupportedTenorHost(hostname: string): boolean {
  const normalizedHost = hostname.trim().toLowerCase();

  return supportedHosts.some(
    (host) => normalizedHost === host || normalizedHost.endsWith(`.${host}`),
  );
}

function sanitizeDetectedUrl(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();

  if (!trimmed) {
    return null;
  }

  return trimmed.replace(/[),.;!?]+$/g, '');
}
