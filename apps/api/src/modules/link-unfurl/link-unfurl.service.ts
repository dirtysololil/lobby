import { Injectable, Logger } from '@nestjs/common';
import {
  LinkEmbedKind,
  LinkEmbedProvider,
  LinkEmbedStatus,
  Prisma,
} from '@prisma/client';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { PrismaService } from '../../database/prisma.service';
import {
  createUrlHash,
  inferDirectMediaKind,
} from './link-unfurl.util';

const requestTimeoutMs = 4_500;
const responseSizeLimitBytes = 512 * 1024;
const maxRedirects = 2;

type ResolvedEmbedPayload = {
  provider: LinkEmbedProvider;
  kind: LinkEmbedKind | null;
  canonicalUrl: string | null;
  canonicalUrlHash: string | null;
  previewUrl: string | null;
  playableUrl: string | null;
  posterUrl: string | null;
  width: number | null;
  height: number | null;
  aspectRatio: number | null;
};

type EmbedProjection = {
  status: LinkEmbedStatus;
  provider: LinkEmbedProvider;
  kind: LinkEmbedKind | null;
  canonicalUrl: string | null;
  canonicalUrlHash: string | null;
  previewUrl: string | null;
  playableUrl: string | null;
  posterUrl: string | null;
  width: number | null;
  height: number | null;
  aspectRatio: number | null;
};

@Injectable()
export class LinkUnfurlService {
  private readonly logger = new Logger(LinkUnfurlService.name);

  public constructor(private readonly prisma: PrismaService) {}

  public async findStalePendingMessageIds(
    olderThanMs: number,
    limit = 20,
  ): Promise<string[]> {
    const before = new Date(Date.now() - olderThanMs);
    const items = await this.prisma.directMessageLinkEmbed.findMany({
      where: {
        status: LinkEmbedStatus.PENDING,
        updatedAt: {
          lte: before,
        },
      },
      select: {
        messageId: true,
      },
      orderBy: {
        updatedAt: 'asc',
      },
      take: limit,
    });

    return items.map((item) => item.messageId);
  }

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
      const resolved = await this.resolveCandidate({
        provider: embed.provider,
        sourceUrl: embed.sourceUrl,
      });

      if (resolved.canonicalUrlHash) {
        const cachedByCanonical = await this.findReusableEmbed({
          provider: resolved.provider,
          canonicalUrlHash: resolved.canonicalUrlHash,
          excludeMessageId: messageId,
        });

        if (cachedByCanonical) {
          await this.markEmbedReady(messageId, {
            ...cachedByCanonical,
            provider: resolved.provider,
            kind: resolved.kind ?? cachedByCanonical.kind,
            canonicalUrl: resolved.canonicalUrl ?? cachedByCanonical.canonicalUrl,
            canonicalUrlHash:
              resolved.canonicalUrlHash ?? cachedByCanonical.canonicalUrlHash,
            previewUrl: resolved.previewUrl ?? cachedByCanonical.previewUrl,
            playableUrl: resolved.playableUrl ?? cachedByCanonical.playableUrl,
            posterUrl: resolved.posterUrl ?? cachedByCanonical.posterUrl,
            width: resolved.width ?? cachedByCanonical.width,
            height: resolved.height ?? cachedByCanonical.height,
            aspectRatio: resolved.aspectRatio ?? cachedByCanonical.aspectRatio,
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

  private async resolveCandidate(
    candidate: { provider: LinkEmbedProvider | string; sourceUrl: string },
  ): Promise<ResolvedEmbedPayload> {
    if (candidate.provider === LinkEmbedProvider.DIRECT_MEDIA) {
      return await this.resolveDirectMedia(candidate.sourceUrl);
    }

    if (candidate.provider === LinkEmbedProvider.TENOR) {
      return await this.resolveTenorEmbed(candidate.sourceUrl);
    }

    return await this.resolveGenericEmbed(candidate.sourceUrl);
  }

  private async resolveDirectMedia(
    sourceUrl: string,
  ): Promise<ResolvedEmbedPayload> {
    const parsedUrl = new URL(sourceUrl);

    await assertSafeRemoteUrl(parsedUrl, null);

    const kind = inferDirectMediaKind(parsedUrl);

    if (!kind) {
      throw new Error('UNSUPPORTED_DIRECT_MEDIA');
    }

    return {
      provider: LinkEmbedProvider.DIRECT_MEDIA,
      kind: toPrismaLinkEmbedKind(kind),
      canonicalUrl: parsedUrl.toString(),
      canonicalUrlHash: createUrlHash(parsedUrl.toString()),
      previewUrl:
        kind === 'VIDEO'
          ? null
          : parsedUrl.toString(),
      playableUrl:
        kind === 'VIDEO' || kind === 'GIF'
          ? parsedUrl.toString()
          : null,
      posterUrl: kind === 'VIDEO' ? null : parsedUrl.toString(),
      width: null,
      height: null,
      aspectRatio: null,
    };
  }

  private async resolveTenorEmbed(
    sourceUrl: string,
  ): Promise<ResolvedEmbedPayload> {
    const { responseUrl, html } = await this.fetchHtml(sourceUrl, {
      allowedHosts: ['tenor.com', 'tenor.co'],
      allowHtmlStatuses: [404],
    });
    const canonicalUrl =
      sanitizePublicMediaUrl(
        getLinkHref(html, 'canonical') ?? getMetaContent(html, 'og:url'),
      ) ?? responseUrl;
    const tenorApiResult = await this.resolveTenorViaApi(sourceUrl, html);

    const tenorCandidates = extractTenorMediaCandidates(html);
    const openGraphFallback = await this.resolveOpenGraphFromHtml(
      html,
      responseUrl,
      LinkEmbedProvider.TENOR,
    );
    const playableUrl =
      tenorApiResult?.playableUrl ??
      tenorCandidates.playableUrl ??
      openGraphFallback.playableUrl ??
      null;
    const previewUrl =
      tenorApiResult?.previewUrl ??
      tenorCandidates.previewUrl ??
      openGraphFallback.previewUrl ??
      openGraphFallback.posterUrl ??
      null;
    const posterUrl =
      tenorApiResult?.posterUrl ??
      tenorCandidates.posterUrl ??
      openGraphFallback.posterUrl ??
      previewUrl ??
      null;
    const width =
      tenorApiResult?.width ?? tenorCandidates.width ?? openGraphFallback.width;
    const height =
      tenorApiResult?.height ?? tenorCandidates.height ?? openGraphFallback.height;
    const kind =
      tenorApiResult?.kind ??
      tenorCandidates.kind ??
      openGraphFallback.kind ??
      inferKindFromResolvedUrls({
        playableUrl,
        previewUrl,
      });

    if (!playableUrl && !previewUrl) {
      throw new Error('EMBED_EMPTY');
    }

    return {
      provider: LinkEmbedProvider.TENOR,
      kind,
      canonicalUrl,
      canonicalUrlHash: canonicalUrl ? createUrlHash(canonicalUrl) : null,
      previewUrl,
      playableUrl,
      posterUrl,
      width,
      height,
      aspectRatio: resolveAspectRatio(width, height),
    };
  }

  private async resolveTenorViaApi(
    sourceUrl: string,
    html: string,
  ): Promise<{
    kind: LinkEmbedKind | null;
    playableUrl: string | null;
    previewUrl: string | null;
    posterUrl: string | null;
    width: number | null;
    height: number | null;
  } | null> {
    const tenorId = extractTenorIdFromUrl(sourceUrl);
    const tenorConfig = extractTenorApiConfig(html);

    if (!tenorId || !tenorConfig) {
      return null;
    }

    const apiBaseUrl = new URL(
      tenorConfig.baseUrl.endsWith('/')
        ? tenorConfig.baseUrl
        : `${tenorConfig.baseUrl}/`,
    );
    const apiUrl = new URL('posts', apiBaseUrl);
    apiUrl.searchParams.set('ids', tenorId);
    apiUrl.searchParams.set('key', tenorConfig.key);
    apiUrl.searchParams.set('client_key', tenorConfig.clientKey);
    apiUrl.searchParams.set(
      'media_filter',
      'mp4,webm,tinymp4,tinywebm,nanomp4,nanowebm,webp,tinywebp,gif,tinygif,nanogif',
    );
    apiUrl.searchParams.set('contentfilter', 'off');

    await assertSafeRemoteUrl(apiUrl, ['tenor.googleapis.com']);
    const response = await fetch(apiUrl, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'LobbyLinkUnfurl/1.0',
      },
      redirect: 'manual',
      signal: AbortSignal.timeout(requestTimeoutMs),
    });

    if (!response.ok) {
      return null;
    }

    const rawText = await readTextWithLimit(response, responseSizeLimitBytes);

    try {
      const payload = JSON.parse(rawText) as {
        results?: Array<{
          media_formats?: Record<
            string,
            {
              url?: string;
              dims?: [number, number];
            }
          >;
        }>;
      };
      const mediaFormats = payload.results?.[0]?.media_formats;

      if (!mediaFormats) {
        return null;
      }

      const playableUrl = pickTenorMediaUrl(mediaFormats, [
        'mp4',
        'tinymp4',
        'nanomp4',
        'webm',
        'tinywebm',
        'nanowebm',
        'webp',
        'tinywebp',
        'gif',
        'tinygif',
        'nanogif',
      ]);
      const previewUrl =
        pickTenorMediaUrl(mediaFormats, [
          'tinygif',
          'nanogif',
          'gif',
          'tinywebp',
          'webp',
          'mp4',
          'tinymp4',
        ]) ?? playableUrl;
      const posterUrl = previewUrl;
      const dims =
        pickTenorMediaDims(mediaFormats, [
          'mp4',
          'tinymp4',
          'webm',
          'tinywebm',
          'gif',
          'tinygif',
        ]) ?? null;
      const width = dims?.[0] ?? null;
      const height = dims?.[1] ?? null;

      return {
        kind: inferKindFromResolvedUrls({
          playableUrl,
          previewUrl,
        }),
        playableUrl,
        previewUrl,
        posterUrl,
        width,
        height,
      };
    } catch {
      return null;
    }
  }

  private async resolveGenericEmbed(
    sourceUrl: string,
  ): Promise<ResolvedEmbedPayload> {
    const { responseUrl, html } = await this.fetchHtml(sourceUrl, {
      allowedHosts: null,
    });
    const resolved = await this.resolveOpenGraphFromHtml(
      html,
      responseUrl,
      LinkEmbedProvider.OPEN_GRAPH,
    );

    if (!resolved.playableUrl && !resolved.previewUrl) {
      throw new Error('EMBED_EMPTY');
    }

    return resolved;
  }

  private async resolveOpenGraphFromHtml(
    html: string,
    responseUrl: string,
    provider: LinkEmbedProvider,
  ): Promise<ResolvedEmbedPayload> {
    const oEmbedResult = getLinkHref(html, 'alternate')?.includes('oembed')
      ? await this.tryResolveOEmbed(
          getLinkHref(html, 'alternate'),
          provider,
        )
      : null;
    const canonicalUrl =
      sanitizePublicMediaUrl(
        getLinkHref(html, 'canonical') ?? getMetaContent(html, 'og:url'),
      ) ?? responseUrl;
    const previewUrl =
      oEmbedResult?.previewUrl ??
      sanitizePublicMediaUrl(
        getMetaContent(html, 'twitter:image') ??
          getMetaContent(html, 'og:image') ??
          getJsonLdValue(html, ['thumbnailUrl']) ??
          getJsonLdValue(html, ['image', 'url']) ??
          getJsonLdValue(html, ['image', 'contentUrl']),
      );
    const playableUrl =
      oEmbedResult?.playableUrl ??
      sanitizePublicMediaUrl(
        getMetaContent(html, 'twitter:player:stream') ??
          getMetaContent(html, 'og:video:url') ??
          getMetaContent(html, 'og:video:secure_url') ??
          getMetaContent(html, 'og:video') ??
          getJsonLdValue(html, ['video', 'contentUrl']),
      );
    const posterUrl = previewUrl;
    const width = coercePositiveInt(
      getMetaContent(html, 'og:video:width') ??
        getMetaContent(html, 'og:image:width') ??
        getJsonLdValue(html, ['video', 'width']) ??
        getJsonLdValue(html, ['image', 'width']) ??
        oEmbedResult?.width ??
        null,
    );
    const height = coercePositiveInt(
      getMetaContent(html, 'og:video:height') ??
        getMetaContent(html, 'og:image:height') ??
        getJsonLdValue(html, ['video', 'height']) ??
        getJsonLdValue(html, ['image', 'height']) ??
        oEmbedResult?.height ??
        null,
    );

    return {
      provider,
      kind: inferKindFromResolvedUrls({
        playableUrl,
        previewUrl,
      }),
      canonicalUrl,
      canonicalUrlHash: canonicalUrl ? createUrlHash(canonicalUrl) : null,
      previewUrl,
      playableUrl,
      posterUrl,
      width,
      height,
      aspectRatio: resolveAspectRatio(width, height),
    };
  }

  private async tryResolveOEmbed(
    value: string | null,
    provider: LinkEmbedProvider,
  ): Promise<{
    previewUrl: string | null;
    playableUrl: string | null;
    width: string | null;
    height: string | null;
    provider: LinkEmbedProvider;
  } | null> {
    if (!value) {
      return null;
    }

    let oEmbedUrl: URL;

    try {
      oEmbedUrl = new URL(value);
    } catch {
      return null;
    }

    if (!/^https?:$/i.test(oEmbedUrl.protocol)) {
      return null;
    }

    await assertSafeRemoteUrl(oEmbedUrl, null);
    const response = await fetch(oEmbedUrl, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'LobbyLinkUnfurl/1.0',
      },
      redirect: 'manual',
      signal: AbortSignal.timeout(requestTimeoutMs),
    });

    if (!response.ok) {
      return null;
    }

    const rawText = await readTextWithLimit(response, responseSizeLimitBytes);

    try {
      const payload = JSON.parse(rawText) as {
        thumbnail_url?: string;
        url?: string;
        width?: string | number;
        height?: string | number;
      };

      return {
        provider,
        previewUrl: sanitizePublicMediaUrl(payload.thumbnail_url ?? null),
        playableUrl: sanitizePublicMediaUrl(payload.url ?? null),
        width:
          typeof payload.width === 'number'
            ? String(payload.width)
            : payload.width ?? null,
        height:
          typeof payload.height === 'number'
            ? String(payload.height)
            : payload.height ?? null,
      };
    } catch {
      return null;
    }
  }

  private async fetchHtml(
    url: string,
    options: {
      allowedHosts: string[] | null;
      allowHtmlStatuses?: number[];
    },
  ): Promise<{ responseUrl: string; html: string }> {
    let currentUrl = new URL(url);

    for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
      await assertSafeRemoteUrl(currentUrl, options.allowedHosts);
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

      const contentType = response.headers.get('content-type') ?? '';

      if (
        !response.ok &&
        !options.allowHtmlStatuses?.includes(response.status)
      ) {
        throw new Error(`HTTP_${response.status}`);
      }

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

  private async findReusableEmbed(args: {
    provider: LinkEmbedProvider;
    sourceUrlHash?: string;
    canonicalUrlHash?: string | null;
    excludeMessageId: string;
  }): Promise<EmbedProjection | null> {
    const conditions: Prisma.DirectMessageLinkEmbedWhereInput[] = [];

    if (args.sourceUrlHash) {
      conditions.push({
        sourceUrlHash: args.sourceUrlHash,
      });
    }

    if (args.canonicalUrlHash) {
      conditions.push({
        canonicalUrlHash: args.canonicalUrlHash,
      });
    }

    if (conditions.length === 0) {
      return null;
    }

    const reusable = await this.prisma.directMessageLinkEmbed.findFirst({
      where: {
        provider: args.provider,
        status: LinkEmbedStatus.READY,
        messageId: {
          not: args.excludeMessageId,
        },
        OR: conditions,
      },
      select: {
        status: true,
        provider: true,
        kind: true,
        canonicalUrl: true,
        canonicalUrlHash: true,
        previewUrl: true,
        playableUrl: true,
        posterUrl: true,
        width: true,
        height: true,
        aspectRatio: true,
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
        provider: payload.provider,
        kind: payload.kind,
        canonicalUrl: payload.canonicalUrl,
        canonicalUrlHash: payload.canonicalUrlHash,
        previewUrl: payload.previewUrl,
        playableUrl: payload.playableUrl,
        posterUrl: payload.posterUrl,
        width: payload.width,
        height: payload.height,
        aspectRatio: payload.aspectRatio,
        failureCode: null,
      },
    });
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

async function assertSafeRemoteUrl(
  url: URL,
  allowedHosts: string[] | null,
): Promise<void> {
  if (!/^https?:$/i.test(url.protocol)) {
    throw new Error('UNSUPPORTED_PROTOCOL');
  }

  if (allowedHosts && !isHostnameAllowed(url.hostname, allowedHosts)) {
    throw new Error('HOST_NOT_ALLOWED');
  }

  if (isPrivateAddress(url.hostname)) {
    throw new Error('BLOCKED_IP_RANGE');
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

function isHostnameAllowed(hostname: string, allowedHosts: string[]): boolean {
  const normalizedHost = hostname.trim().toLowerCase();

  return allowedHosts.some((host) => {
    const normalizedAllowedHost = host.trim().toLowerCase();
    return (
      normalizedHost === normalizedAllowedHost ||
      normalizedHost.endsWith(`.${normalizedAllowedHost}`)
    );
  });
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

  return false;
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

function getJsonLdValue(html: string, path: string[]): string | null {
  const blocks = [
    ...html.matchAll(
      /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    ),
  ];

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

function extractTenorMediaCandidates(html: string): {
  kind: LinkEmbedKind | null;
  playableUrl: string | null;
  previewUrl: string | null;
  posterUrl: string | null;
  width: number | null;
  height: number | null;
} {
  const rawUrls = [
    ...new Set([
      ...html.matchAll(/https?:\/\/[^"'\\<>\s]+/gi),
    ].map((match) => decodeHtmlEntities(match[0]))),
  ];
  const mediaUrls = rawUrls
    .map((value) => sanitizePublicMediaUrl(value))
    .filter((value): value is string => Boolean(value))
    .filter((value) => {
      try {
        const url = new URL(value);
        return url.hostname.toLowerCase().includes('tenor');
      } catch {
        return false;
      }
    });

  const playableUrl =
    mediaUrls.find((value) => value.match(/\.mp4(\?|$)/i)) ??
    mediaUrls.find((value) => value.match(/\.webm(\?|$)/i)) ??
    mediaUrls.find((value) => value.match(/\.webp(\?|$)/i)) ??
    mediaUrls.find((value) => value.match(/\.gif(\?|$)/i)) ??
    null;
  const previewUrl =
    mediaUrls.find((value) => value.match(/\.(jpg|jpeg|png)(\?|$)/i)) ??
    mediaUrls.find((value) => value.match(/\.webp(\?|$)/i)) ??
    null;

  return {
    kind: inferKindFromResolvedUrls({
      playableUrl,
      previewUrl,
    }),
    playableUrl,
    previewUrl,
    posterUrl: previewUrl,
    width: coercePositiveInt(
      getMetaContent(html, 'og:video:width') ??
        getMetaContent(html, 'og:image:width') ??
        getJsonLdValue(html, ['video', 'width']) ??
        getJsonLdValue(html, ['image', 'width']),
    ),
    height: coercePositiveInt(
      getMetaContent(html, 'og:video:height') ??
        getMetaContent(html, 'og:image:height') ??
        getJsonLdValue(html, ['video', 'height']) ??
        getJsonLdValue(html, ['image', 'height']),
    ),
  };
}

function extractTenorApiConfig(html: string): {
  baseUrl: string;
  key: string;
  clientKey: string;
} | null {
  const match = html.match(
    /<script id="data" type="text\/x-cache"[^>]*>([^<]+)<\/script>/i,
  );

  if (!match?.[1]) {
    return null;
  }

  try {
    const decoded = Buffer.from(match[1], 'base64').toString('utf8');
    const payload = JSON.parse(decoded) as {
      API_V2_URL?: string;
      API_V2_KEY?: string;
      API_V2_CLIENT_KEY?: string;
    };

    if (
      typeof payload.API_V2_URL !== 'string' ||
      typeof payload.API_V2_KEY !== 'string' ||
      typeof payload.API_V2_CLIENT_KEY !== 'string'
    ) {
      return null;
    }

    return {
      baseUrl: payload.API_V2_URL,
      key: payload.API_V2_KEY,
      clientKey: payload.API_V2_CLIENT_KEY,
    };
  } catch {
    return null;
  }
}

function extractTenorIdFromUrl(sourceUrl: string): string | null {
  try {
    const parsedUrl = new URL(sourceUrl);
    const path = parsedUrl.pathname.replace(/\/+$/, '');
    const match = path.match(/-([0-9]{6,})$/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function pickTenorMediaUrl(
  mediaFormats: Record<string, { url?: string; dims?: [number, number] }>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = sanitizePublicMediaUrl(mediaFormats[key]?.url ?? null);

    if (value) {
      return value;
    }
  }

  return null;
}

function pickTenorMediaDims(
  mediaFormats: Record<string, { url?: string; dims?: [number, number] }>,
  keys: string[],
): [number, number] | null {
  for (const key of keys) {
    const dims = mediaFormats[key]?.dims;

    if (
      Array.isArray(dims) &&
      dims.length === 2 &&
      Number.isFinite(dims[0]) &&
      Number.isFinite(dims[1]) &&
      dims[0] > 0 &&
      dims[1] > 0
    ) {
      return [dims[0], dims[1]];
    }
  }

  return null;
}

function sanitizePublicMediaUrl(value: string | null): string | null {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);

    if (!/^https?:$/i.test(url.protocol)) {
      return null;
    }

    if (isPrivateAddress(url.hostname)) {
      return null;
    }

    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

function inferKindFromResolvedUrls(args: {
  playableUrl: string | null;
  previewUrl: string | null;
}): LinkEmbedKind | null {
  if (args.playableUrl) {
    if (args.playableUrl.match(/\.(mp4|webm)(\?|$)/i)) {
      return LinkEmbedKind.VIDEO;
    }

    if (args.playableUrl.match(/\.(gif|webp)(\?|$)/i)) {
      return LinkEmbedKind.GIF;
    }
  }

  if (args.previewUrl) {
    if (args.previewUrl.match(/\.gif(\?|$)/i)) {
      return LinkEmbedKind.GIF;
    }

    return LinkEmbedKind.IMAGE;
  }

  return null;
}

function toPrismaLinkEmbedKind(
  kind: 'IMAGE' | 'VIDEO' | 'GIF',
): LinkEmbedKind {
  if (kind === 'VIDEO') {
    return LinkEmbedKind.VIDEO;
  }

  if (kind === 'GIF') {
    return LinkEmbedKind.GIF;
  }

  return LinkEmbedKind.IMAGE;
}

function resolveAspectRatio(
  width: number | null,
  height: number | null,
): number | null {
  return width && height ? Number((width / height).toFixed(4)) : null;
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
