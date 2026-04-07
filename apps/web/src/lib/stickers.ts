import type { StickerAsset } from "@lobby/shared";
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
