import type { DmLinkEmbed } from "@lobby/shared";

const urlPattern = /https?:\/\/[^\s<>"'`]+/giu;

export function extractFirstSupportedLink(
  text: string | null | undefined,
): { provider: "TENOR"; sourceUrl: string } | null {
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

      if (
        /^https?:$/i.test(url.protocol) &&
        (normalizedHost === "tenor.com" ||
          normalizedHost === "tenor.co" ||
          normalizedHost.endsWith(".tenor.com") ||
          normalizedHost.endsWith(".tenor.co"))
      ) {
        url.hash = "";

        return {
          provider: "TENOR",
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
  const candidate = extractFirstSupportedLink(text);

  if (!candidate) {
    return null;
  }

  return {
    status: "PENDING",
    provider: candidate.provider,
    sourceUrl: candidate.sourceUrl,
    canonicalUrl: null,
    title: null,
    previewImage: null,
    animatedMediaUrl: null,
    width: null,
    height: null,
    aspectRatio: null,
    contentType: null,
  };
}

function sanitizeDetectedUrl(value: string): string | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  return trimmed.replace(/[),.;!?]+$/g, "");
}
