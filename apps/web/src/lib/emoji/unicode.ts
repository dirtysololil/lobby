import { defaultEmojiManifestVersion } from "@lobby/shared";

const emojiClusterPattern =
  /(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|[#*0-9]\uFE0F?\u20E3)/u;
const segmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter("ru", { granularity: "grapheme" })
    : null;

export function splitGraphemes(value: string): string[] {
  if (!value) {
    return [];
  }

  if (segmenter) {
    return Array.from(segmenter.segment(value), (item) => item.segment);
  }

  return Array.from(value);
}

export function isEmojiCluster(value: string): boolean {
  return emojiClusterPattern.test(value);
}

export function toEmojiAssetCode(value: string): string {
  return Array.from(value)
    .map((char) => char.codePointAt(0)?.toString(16))
    .filter((item): item is string => Boolean(item))
    .join("-");
}

export function getEmojiAssetUrl(value: string): string {
  return `https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg/${toEmojiAssetCode(
    value,
  )}.svg?v=${encodeURIComponent(defaultEmojiManifestVersion)}`;
}
