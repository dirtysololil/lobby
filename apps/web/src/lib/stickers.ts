import type { CustomEmojiAsset, GifAsset, StickerAsset } from "@lobby/shared";
import {
  resolveApiBaseUrlForBrowser,
  resolveApiBaseUrlForServer,
} from "./runtime-config";

export function getStickerAssetUrl(sticker: Pick<StickerAsset, "id" | "updatedAt">): string {
  const baseUrl =
    typeof window === "undefined"
      ? resolveApiBaseUrlForServer()
      : resolveApiBaseUrlForBrowser();
  const path = `/v1/stickers/${sticker.id}/asset?v=${encodeURIComponent(sticker.updatedAt)}`;

  return baseUrl ? `${baseUrl}${path}` : path;
}

export function getCustomEmojiAssetUrl(
  emoji: Pick<CustomEmojiAsset, "id" | "updatedAt">,
): string {
  const baseUrl =
    typeof window === "undefined"
      ? resolveApiBaseUrlForServer()
      : resolveApiBaseUrlForBrowser();
  const path = `/v1/media/custom-emojis/${emoji.id}/asset?v=${encodeURIComponent(emoji.updatedAt)}`;

  return baseUrl ? `${baseUrl}${path}` : path;
}

export function getGifAssetUrl(gif: Pick<GifAsset, "id" | "updatedAt">): string {
  const baseUrl =
    typeof window === "undefined"
      ? resolveApiBaseUrlForServer()
      : resolveApiBaseUrlForBrowser();
  const path = `/v1/media/gifs/${gif.id}/asset?v=${encodeURIComponent(gif.updatedAt)}`;

  return baseUrl ? `${baseUrl}${path}` : path;
}

export const customEmojiTokenPattern = /:([a-z0-9_+-]{2,32}):/gi;

export function buildCustomEmojiToken(alias: string): string {
  return `:${alias}:`;
}

export function reorderItems<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length ||
    fromIndex === toIndex
  ) {
    return items;
  }

  const nextItems = [...items];
  const [movedItem] = nextItems.splice(fromIndex, 1);

  if (!movedItem) {
    return items;
  }

  nextItems.splice(toIndex, 0, movedItem);
  return nextItems;
}
