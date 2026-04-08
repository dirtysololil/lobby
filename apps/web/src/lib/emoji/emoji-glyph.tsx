"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { cn } from "@/lib/utils";
import { getEmojiAssetUrl } from "./unicode";

interface EmojiGlyphProps {
  emoji: string;
  label?: string;
  className?: string;
  fallbackClassName?: string;
}

export function EmojiGlyph({
  emoji,
  label,
  className,
  fallbackClassName,
}: EmojiGlyphProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span className={cn("inline-block", fallbackClassName)}>{emoji}</span>
    );
  }

  return (
    <img
      src={getEmojiAssetUrl(emoji)}
      alt={label ?? emoji}
      draggable={false}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn("inline-block object-contain", className)}
    />
  );
}
