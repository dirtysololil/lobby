"use client";

/* eslint-disable @next/next/no-img-element */
import type { StickerAsset } from "@lobby/shared";
import { ImageOff } from "lucide-react";
import { useMemo, useState } from "react";
import { getStickerAssetUrl } from "@/lib/stickers";
import { cn } from "@/lib/utils";

interface StickerAssetPreviewProps {
  sticker: StickerAsset;
  className?: string;
  imageClassName?: string;
  fallbackLabel?: string;
}

export function StickerAssetPreview({
  sticker,
  className,
  imageClassName,
  fallbackLabel = "Стикер недоступен",
}: StickerAssetPreviewProps) {
  const [hasError, setHasError] = useState(false);
  const stickerUrl = useMemo(() => getStickerAssetUrl(sticker), [sticker]);

  if (hasError) {
    return (
      <div
        className={cn(
          "flex aspect-square w-full items-center justify-center rounded-[20px] bg-white/[0.03] px-4 text-center text-xs text-[var(--text-muted)]",
          className,
        )}
      >
        <div className="grid gap-2">
          <ImageOff size={18} strokeWidth={1.5} className="mx-auto" />
          <span>{fallbackLabel}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("overflow-hidden", className)}>
      <img
        src={stickerUrl}
        alt={sticker.title}
        className={cn("h-full w-full object-contain", imageClassName)}
        draggable={false}
        loading="lazy"
        onError={() => setHasError(true)}
      />
    </div>
  );
}
