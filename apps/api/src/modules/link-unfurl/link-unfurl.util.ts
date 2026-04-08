import { createHash } from 'node:crypto';

const urlPattern = /https?:\/\/[^\s<>"'`]+/giu;
const tenorHosts = ['tenor.com', 'tenor.co'] as const;
const directMediaExtensions = new Map<
  string,
  'IMAGE' | 'VIDEO' | 'GIF'
>([
  ['gif', 'GIF'],
  ['webp', 'GIF'],
  ['mp4', 'VIDEO'],
  ['webm', 'VIDEO'],
  ['png', 'IMAGE'],
  ['jpg', 'IMAGE'],
  ['jpeg', 'IMAGE'],
]);

export interface LinkUnfurlCandidate {
  provider: 'TENOR' | 'DIRECT_MEDIA';
  sourceUrl: string;
}

export function extractFirstEmbeddableLink(
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

    const candidate = toEmbeddableCandidate(rawUrl);

    if (candidate) {
      return candidate;
    }
  }

  return null;
}

export function toEmbeddableCandidate(
  rawUrl: string,
): LinkUnfurlCandidate | null {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    return null;
  }

  if (!/^https?:$/i.test(parsedUrl.protocol)) {
    return null;
  }

  parsedUrl.hash = '';

  if (isSupportedTenorHost(parsedUrl.hostname)) {
    return {
      provider: 'TENOR',
      sourceUrl: parsedUrl.toString(),
    };
  }

  if (inferDirectMediaKind(parsedUrl)) {
    return {
      provider: 'DIRECT_MEDIA',
      sourceUrl: parsedUrl.toString(),
    };
  }

  return null;
}

export function createUrlHash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function isSupportedTenorHost(hostname: string): boolean {
  const normalizedHost = hostname.trim().toLowerCase();

  return tenorHosts.some(
    (host) => normalizedHost === host || normalizedHost.endsWith(`.${host}`),
  );
}

export function inferDirectMediaKind(
  url: URL | string,
): 'IMAGE' | 'VIDEO' | 'GIF' | null {
  const parsedUrl = typeof url === 'string' ? safeParseUrl(url) : url;

  if (!parsedUrl) {
    return null;
  }

  const match = /\.([a-z0-9]+)$/i.exec(parsedUrl.pathname);
  const extension = match?.[1]?.toLowerCase() ?? null;

  if (!extension) {
    return null;
  }

  return directMediaExtensions.get(extension) ?? null;
}

export function sanitizeDetectedUrl(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();

  if (!trimmed) {
    return null;
  }

  return trimmed.replace(/[),.;!?]+$/g, '');
}

function safeParseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}
