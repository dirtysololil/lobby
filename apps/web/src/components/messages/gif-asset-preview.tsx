"use client";

/* eslint-disable @next/next/no-img-element */
import type { GifAsset } from "@lobby/shared";
import { Film, ImageOff } from "lucide-react";
import { useMemo, useState } from "react";
import { getGifAssetUrl } from "@/lib/stickers";
import { cn } from "@/lib/utils";

interface GifAssetPreviewProps {
  gif: GifAsset;
  className?: string;
  imageClassName?: string;
  showBadge?: boolean;
  fallbackLabel?: string;
}

export function GifAssetPreview({
  gif,
  className,
  imageClassName,
  showBadge = false,
  fallbackLabel = "GIF недоступен",
}: GifAssetPreviewProps) {
  const [hasError, setHasError] = useState(false);
  const gifUrl = useMemo(() => getGifAssetUrl(gif), [gif]);

  if (hasError) {
    return (
      <div
        className={cn(
          "flex aspect-[4/3] w-full items-center justify-center rounded-[20px] border border-white/8 bg-white/[0.03] px-4 text-center text-xs text-[var(--text-muted)]",
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
    <div className={cn("relative overflow-hidden", className)}>
      <img
        src={gifUrl}
        alt={gif.title}
        className={cn("h-full w-full object-cover", imageClassName)}
        draggable={false}
        loading="lazy"
        onError={() => setHasError(true)}
      />
      {showBadge ? (
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full border border-black/20 bg-black/55 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-white">
          <Film size={12} strokeWidth={1.6} />
          GIF
        </span>
      ) : null}
    </div>
  );
}
