import { Injectable, Logger } from '@nestjs/common';
import { LinkEmbedProvider, LinkEmbedStatus, Prisma } from '@prisma/client';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { PrismaService } from '../../database/prisma.service';
import {
  createUrlHash,
  isSupportedTenorHost,
  type LinkUnfurlCandidate,
} from './link-unfurl.util';

const requestTimeoutMs = 4_500;
const responseSizeLimitBytes = 512 * 1024;
const maxRedirects = 2;

type ResolvedEmbedPayload = {
  canonicalUrl: string | null;
  canonicalUrlHash: string | null;
  title: string | null;
  previewImage: string | null;
  animatedMediaUrl: string | null;
  width: number | null;
  height: number | null;
  aspectRatio: number | null;
  contentType: string | null;
};

type EmbedProjection = {
  status: LinkEmbedStatus;
  canonicalUrl: string | null;
  canonicalUrlHash: string | null;
  title: string | null;
  previewImage: string | null;
  animatedMediaUrl: string | null;
  width: number | null;
  height: number | null;
  aspectRatio: number | null;
  contentType: string | null;
};

@Injectable()
export class LinkUnfurlService {
  private readonly logger = new Logger(LinkUnfurlService.name);

  public constructor(private readonly prisma: PrismaService) {}

  public async processMessage(messageId: string): Promise<boolean> {
    const embed = await this.prisma.directMessageLinkEmbed.findUnique({
      where: {
        messageId,
      },
      include: {
        message: {
          select: {
            id: true,
            type: true,
            deletedAt: true,
          },
        },
      },
    });

    if (
      !embed ||
      embed.status !== LinkEmbedStatus.PENDING ||
      !embed.message ||
      embed.message.deletedAt ||
      embed.message.type !== 'TEXT'
    ) {
      return false;
    }

    const cachedBySource = await this.findReusableEmbed({
      provider: embed.provider,
      sourceUrlHash: embed.sourceUrlHash,
      excludeMessageId: messageId,
    });

    if (cachedBySource) {
      await this.markEmbedReady(messageId, cachedBySource);
      return true;
    }

    try {
      const resolved = await this.resolveTenorEmbed({
        provider: 'TENOR',
        sourceUrl: embed.sourceUrl,
      });

      if (resolved.canonicalUrlHash) {
        const cachedByCanonical = await this.findReusableEmbed({
          provider: embed.provider,
          canonicalUrlHash: resolved.canonicalUrlHash,
          excludeMessageId: messageId,
        });

        if (cachedByCanonical) {
          await this.markEmbedReady(messageId, {
            ...cachedByCanonical,
            canonicalUrl: resolved.canonicalUrl,
            canonicalUrlHash: resolved.canonicalUrlHash,
          });
          return true;
        }
      }

      await this.markEmbedReady(messageId, {
        status: LinkEmbedStatus.READY,
        ...resolved,
      });

      return true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message.slice(0, 120) : 'UNFURL_FAILED';
      this.logger.warn(`Failed to unfurl DM link ${messageId}: ${message}`);

      await this.prisma.directMessageLinkEmbed.update({
        where: {
          messageId,
        },
        data: {
          status: LinkEmbedStatus.FAILED,
          failureCode: message,
        },
      });

      return true;
    }
  }

  private async findReusableEmbed(args: {
    provider: LinkEmbedProvider;
    sourceUrlHash?: string;
    canonicalUrlHash?: string | null;
    excludeMessageId: string;
  }): Promise<EmbedProjection | null> {
    const where: Prisma.DirectMessageLinkEmbedWhereInput = {
      provider: args.provider,
      status: LinkEmbedStatus.READY,
      messageId: {
        not: args.excludeMessageId,
      },
      ...(args.sourceUrlHash
        ? {
            sourceUrlHash: args.sourceUrlHash,
          }
        : {}),
      ...(args.canonicalUrlHash
        ? {
            canonicalUrlHash: args.canonicalUrlHash,
          }
        : {}),
    };

    const reusable = await this.prisma.directMessageLinkEmbed.findFirst({
      where,
      select: {
        status: true,
        canonicalUrl: true,
        canonicalUrlHash: true,
        title: true,
        previewImage: true,
        animatedMediaUrl: true,
        width: true,
        height: true,
        aspectRatio: true,
        contentType: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return reusable;
  }

  private async markEmbedReady(
    messageId: string,
    payload: EmbedProjection,
  ): Promise<void> {
    await this.prisma.directMessageLinkEmbed.update({
      where: {
        messageId,
      },
      data: {
        status: payload.status,
        canonicalUrl: payload.canonicalUrl,
        canonicalUrlHash: payload.canonicalUrlHash,
        title: payload.title,
        previewImage: payload.previewImage,
        animatedMediaUrl: payload.animatedMediaUrl,
        width: payload.width,
        height: payload.height,
        aspectRatio: payload.aspectRatio,
        contentType: payload.contentType,
        failureCode: null,
      },
    });
  }

  private async resolveTenorEmbed(
    candidate: LinkUnfurlCandidate,
  ): Promise<ResolvedEmbedPayload> {
    const { responseUrl, html } = await this.fetchHtml(candidate.sourceUrl);

    const canonicalUrl =
      sanitizeExternalMediaUrl(
        getLinkHref(html, 'canonical') ?? getMetaContent(html, 'og:url'),
      ) ?? responseUrl;
    const title =
      decodeHtmlEntities(
        getMetaContent(html, 'og:title') ??
          getMetaContent(html, 'twitter:title') ??
          getDocumentTitle(html) ??
          '',
      ) || null;
    const previewImage = sanitizeExternalMediaUrl(
      getMetaContent(html, 'twitter:image') ??
        getMetaContent(html, 'og:image') ??
        getJsonLdValue(html, ['thumbnailUrl']) ??
        getJsonLdValue(html, ['image', 'url']) ??
        getJsonLdValue(html, ['image', 'contentUrl']),
    );
    const animatedMediaUrl = sanitizeExternalMediaUrl(
      getMetaContent(html, 'twitter:player:stream') ??
        getMetaContent(html, 'og:video:url') ??
        getMetaContent(html, 'og:video:secure_url') ??
        getMetaContent(html, 'og:video') ??
        getJsonLdValue(html, ['video', 'contentUrl']),
    );
    const width = coercePositiveInt(
      getMetaContent(html, 'og:video:width') ??
        getMetaContent(html, 'og:image:width') ??
        getJsonLdValue(html, ['video', 'width']) ??
        getJsonLdValue(html, ['image', 'width']),
    );
    const height = coercePositiveInt(
      getMetaContent(html, 'og:video:height') ??
        getMetaContent(html, 'og:image:height') ??
        getJsonLdValue(html, ['video', 'height']) ??
        getJsonLdValue(html, ['image', 'height']),
    );
    const aspectRatio =
      width && height ? Number((width / height).toFixed(4)) : null;
    const contentType =
      getMetaContent(html, 'og:video:type') ??
      getMetaContent(html, 'twitter:player:stream:content_type') ??
      inferContentType(animatedMediaUrl);

    if (!previewImage && !animatedMediaUrl) {
      throw new Error('EMBED_EMPTY');
    }

    return {
      canonicalUrl,
      canonicalUrlHash: canonicalUrl ? createUrlHash(canonicalUrl) : null,
      title,
      previewImage,
      animatedMediaUrl,
      width,
      height,
      aspectRatio,
      contentType,
    };
  }

  private async fetchHtml(
    url: string,
  ): Promise<{ responseUrl: string; html: string }> {
    let currentUrl = new URL(url);

    for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
      await assertSafeRemoteUrl(currentUrl);
      const response = await fetch(currentUrl, {
        headers: {
          Accept: 'text/html,application/xhtml+xml',
          'User-Agent': 'LobbyLinkUnfurl/1.0',
        },
        redirect: 'manual',
        signal: AbortSignal.timeout(requestTimeoutMs),
      });

      if (isRedirectStatus(response.status)) {
        const location = response.headers.get('location');

        if (!location) {
          throw new Error('REDIRECT_WITHOUT_LOCATION');
        }

        currentUrl = new URL(location, currentUrl);
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP_${response.status}`);
      }

      const contentType = response.headers.get('content-type') ?? '';

      if (!contentType.toLowerCase().includes('text/html')) {
        throw new Error('UNSUPPORTED_CONTENT_TYPE');
      }

      const html = await readTextWithLimit(response, responseSizeLimitBytes);

      return {
        responseUrl: currentUrl.toString(),
        html,
      };
    }

    throw new Error('TOO_MANY_REDIRECTS');
  }
}

function isRedirectStatus(status: number): boolean {
  return status >= 300 && status < 400;
}

async function readTextWithLimit(
  response: Response,
  maxBytes: number,
): Promise<string> {
  const reader = response.body?.getReader();

  if (!reader) {
    return await response.text();
  }

  const chunks: Uint8Array[] = [];
  let totalLength = 0;

  while (true) {
    const result = await reader.read();

    if (result.done) {
      break;
    }

    totalLength += result.value.byteLength;

    if (totalLength > maxBytes) {
      await reader.cancel('response size limit exceeded');
      throw new Error('RESPONSE_TOO_LARGE');
    }

    chunks.push(result.value);
  }

  const output = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder('utf-8').decode(output);
}

async function assertSafeRemoteUrl(url: URL): Promise<void> {
  if (!/^https?:$/i.test(url.protocol)) {
    throw new Error('UNSUPPORTED_PROTOCOL');
  }

  if (!isSupportedTenorHost(url.hostname)) {
    throw new Error('HOST_NOT_ALLOWED');
  }

  const addresses = await lookup(url.hostname, {
    all: true,
    verbatim: true,
  });

  if (addresses.length === 0) {
    throw new Error('DNS_LOOKUP_EMPTY');
  }

  for (const entry of addresses) {
    if (isPrivateAddress(entry.address)) {
      throw new Error('BLOCKED_IP_RANGE');
    }
  }
}

function isPrivateAddress(address: string): boolean {
  const kind = isIP(address);

  if (kind === 4) {
    const octets = address.split('.').map((value) => Number(value));
    const [first = Number.NaN, second = Number.NaN] = octets;

    if (octets.length !== 4 || octets.some((value) => Number.isNaN(value))) {
      return true;
    }

    if (first === 10 || first === 127 || first === 0) {
      return true;
    }

    if (first === 169 && second === 254) {
      return true;
    }

    if (first === 172 && second >= 16 && second <= 31) {
      return true;
    }

    if (first === 192 && second === 168) {
      return true;
    }

    if (first === 100 && second >= 64 && second <= 127) {
      return true;
    }

    return false;
  }

  if (kind === 6) {
    const normalized = address.toLowerCase();

    return (
      normalized === '::1' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe8') ||
      normalized.startsWith('fe9') ||
      normalized.startsWith('fea') ||
      normalized.startsWith('feb') ||
      normalized.startsWith('::ffff:10.') ||
      normalized.startsWith('::ffff:127.') ||
      normalized.startsWith('::ffff:169.254.') ||
      normalized.startsWith('::ffff:172.16.') ||
      normalized.startsWith('::ffff:172.17.') ||
      normalized.startsWith('::ffff:172.18.') ||
      normalized.startsWith('::ffff:172.19.') ||
      normalized.startsWith('::ffff:172.2') ||
      normalized.startsWith('::ffff:192.168.')
    );
  }

  return true;
}

function getMetaContent(html: string, key: string): string | null {
  const escapedKey = escapeRegExp(key);
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${escapedKey}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      'i',
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escapedKey}["'][^>]*>`,
      'i',
    ),
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(html);

    if (match?.[1]) {
      return decodeHtmlEntities(match[1].trim());
    }
  }

  return null;
}

function getLinkHref(html: string, rel: string): string | null {
  const escapedRel = escapeRegExp(rel);
  const patterns = [
    new RegExp(
      `<link[^>]+rel=["'][^"']*${escapedRel}[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>`,
      'i',
    ),
    new RegExp(
      `<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*${escapedRel}[^"']*["'][^>]*>`,
      'i',
    ),
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(html);

    if (match?.[1]) {
      return decodeHtmlEntities(match[1].trim());
    }
  }

  return null;
}

function getDocumentTitle(html: string): string | null {
  const match = /<title[^>]*>([^<]+)<\/title>/i.exec(html);
  return match?.[1] ? decodeHtmlEntities(match[1].trim()) : null;
}

function getJsonLdValue(html: string, path: string[]): string | null {
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];

  for (const block of blocks) {
    const rawJson = block[1]?.trim();

    if (!rawJson) {
      continue;
    }

    try {
      const parsed = JSON.parse(rawJson) as unknown;
      const values = Array.isArray(parsed) ? parsed : [parsed];

      for (const value of values) {
        const resolved = readJsonPath(value, path);

        if (typeof resolved === 'string' && resolved.trim().length > 0) {
          return resolved.trim();
        }
      }
    } catch {
      continue;
    }
  }

  return null;
}

function readJsonPath(value: unknown, path: string[]): unknown {
  let current = value;

  for (const key of path) {
    if (!current || typeof current !== 'object') {
      return null;
    }

    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

function sanitizeExternalMediaUrl(value: string | null): string | null {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);

    if (!/^https?:$/i.test(url.protocol)) {
      return null;
    }

    if (!isSupportedTenorHost(url.hostname)) {
      return null;
    }

    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

function inferContentType(value: string | null): string | null {
  if (!value) {
    return null;
  }

  if (value.endsWith('.mp4')) {
    return 'video/mp4';
  }

  if (value.endsWith('.webm')) {
    return 'video/webm';
  }

  if (value.endsWith('.gif')) {
    return 'image/gif';
  }

  return null;
}

function coercePositiveInt(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const normalized = Number.parseInt(value, 10);
  return Number.isFinite(normalized) && normalized > 0 ? normalized : null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}
