import type { DmLinkEmbed } from "@lobby/shared";

const urlPattern = /https?:\/\/[^\s<>"'`]+/giu;
const directMediaPattern = /\.(gif|webp|mp4|webm|png|jpe?g)(\?.*)?$/i;

export function extractFirstEmbeddableLink(
  text: string | null | undefined,
): { provider: "TENOR" | "DIRECT_MEDIA"; sourceUrl: string } | null {
  if (!text) {
    return null;
  }

  for (const match of text.matchAll(urlPattern)) {
    const candidate = sanitizeDetectedUrl(match[0]);

    if (!candidate) {
      continue;
    }

    try {
      const url = new URL(candidate);
      const normalizedHost = url.hostname.trim().toLowerCase();

      if (!/^https?:$/i.test(url.protocol)) {
        continue;
      }

      url.hash = "";

      if (
        normalizedHost === "tenor.com" ||
        normalizedHost === "tenor.co" ||
        normalizedHost.endsWith(".tenor.com") ||
        normalizedHost.endsWith(".tenor.co")
      ) {
        return {
          provider: "TENOR",
          sourceUrl: url.toString(),
        };
      }

      if (directMediaPattern.test(url.pathname)) {
        return {
          provider: "DIRECT_MEDIA",
          sourceUrl: url.toString(),
        };
      }
    } catch {
      continue;
    }
  }

  return null;
}

export function buildPendingLinkEmbed(
  text: string | null | undefined,
): DmLinkEmbed | null {
  const candidate = extractFirstEmbeddableLink(text);

  if (!candidate) {
    return null;
  }

  return {
    status: "PENDING",
    provider: candidate.provider,
    kind: inferPendingKind(candidate.sourceUrl),
    sourceUrl: candidate.sourceUrl,
    canonicalUrl: null,
    previewUrl: null,
    playableUrl: null,
    posterUrl: null,
    width: null,
    height: null,
    aspectRatio: null,
    failureCode: null,
  };
}

export function isStandaloneEmbeddableMessage(
  text: string | null | undefined,
  embed: Pick<DmLinkEmbed, "sourceUrl"> | null | undefined,
): boolean {
  if (!text || !embed?.sourceUrl) {
    return false;
  }

  return stripEmbeddableLinkText(text, embed.sourceUrl) === null;
}

export function hasRenderableLinkEmbedMedia(
  embed: DmLinkEmbed | null | undefined,
): boolean {
  if (!embed) {
    return false;
  }

  if (embed.status === "PENDING") {
    return true;
  }

  return Boolean(embed.previewUrl || embed.playableUrl || embed.posterUrl);
}

export function stripEmbeddableLinkText(
  text: string | null | undefined,
  sourceUrl: string | null | undefined,
): string | null {
  if (!text) {
    return null;
  }

  const candidate = extractFirstEmbeddableLink(text);

  if (!candidate || !sourceUrl || candidate.sourceUrl !== sourceUrl) {
    return text.trim() || null;
  }

  const match = [...text.matchAll(urlPattern)].find((entry) => {
    const normalized = sanitizeDetectedUrl(entry[0]);
    return normalized === sourceUrl;
  });

  if (!match || typeof match.index !== "number") {
    return text.trim() || null;
  }

  const before = text.slice(0, match.index);
  const after = text.slice(match.index + match[0].length);
  const nextText = `${before} ${after}`.replace(/\s+/g, " ").trim();

  return nextText.length > 0 ? nextText : null;
}

function inferPendingKind(sourceUrl: string): DmLinkEmbed["kind"] {
  if (sourceUrl.match(/\.(mp4|webm)(\?.*)?$/i)) {
    return "VIDEO";
  }

  if (sourceUrl.match(/\.(gif|webp)(\?.*)?$/i)) {
    return "GIF";
  }

  if (sourceUrl.match(/\.(png|jpe?g)(\?.*)?$/i)) {
    return "IMAGE";
  }

  return null;
}

function sanitizeDetectedUrl(value: string): string | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  return trimmed.replace(/[),.;!?]+$/g, "");
}
