"use client";

import type { DmLinkEmbed } from "@lobby/shared";
import { LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { EmbeddedMediaBubble } from "@/components/messages/embedded-media-bubble";
import { hasRenderableLinkEmbedMedia } from "@/lib/link-embeds";
import { cn } from "@/lib/utils";

interface LinkEmbedCardProps {
  embed: DmLinkEmbed;
  className?: string;
  messageCreatedAt?: string | null;
}

const pendingStaleAfterMs = 60_000;

export function LinkEmbedCard({
  embed,
  className,
  messageCreatedAt = null,
}: LinkEmbedCardProps) {
  const [isPendingVisible, setIsPendingVisible] = useState(true);

  useEffect(() => {
    if (embed.status !== "PENDING" || !messageCreatedAt) {
      setIsPendingVisible(true);
      return;
    }

    const expiresAt =
      new Date(messageCreatedAt).getTime() + pendingStaleAfterMs - Date.now();

    if (expiresAt <= 0) {
      setIsPendingVisible(false);
      return;
    }

    setIsPendingVisible(true);
    const timer = window.setTimeout(() => {
      setIsPendingVisible(false);
    }, expiresAt);

    return () => {
      window.clearTimeout(timer);
    };
  }, [embed.status, messageCreatedAt]);

  if (embed.status === "FAILED") {
    return null;
  }

  if (embed.status === "PENDING") {
    if (!isPendingVisible) {
      return null;
    }

    return (
      <div
        className={cn(
          "overflow-hidden rounded-[24px] border border-white/8 bg-white/[0.035]",
          className,
        )}
      >
        <div className="aspect-square animate-pulse bg-[linear-gradient(135deg,rgba(106,168,248,0.08),rgba(255,255,255,0.03)_46%,rgba(255,255,255,0.015))]" />
        <div className="flex items-center gap-2 border-t border-white/6 px-3 py-2 text-xs text-[var(--text-muted)]">
          <LoaderCircle size={14} strokeWidth={1.5} className="animate-spin" />
          Подтягиваем превью…
        </div>
      </div>
    );
  }

  if (!hasRenderableLinkEmbedMedia(embed)) {
    return null;
  }

  return (
    <EmbeddedMediaBubble
      kind={embed.kind ?? inferFallbackKind(embed)}
      previewUrl={embed.previewUrl}
      playableUrl={embed.playableUrl}
      posterUrl={embed.posterUrl}
      href={embed.canonicalUrl ?? embed.sourceUrl}
      label={embed.provider === "TENOR" ? "Tenor" : "Медиа"}
      className={className}
    />
  );
}

function inferFallbackKind(embed: DmLinkEmbed): "IMAGE" | "VIDEO" | "GIF" {
  if (embed.playableUrl?.match(/\.(mp4|webm)(\?.*)?$/i)) {
    return "VIDEO";
  }

  if (embed.playableUrl || embed.previewUrl?.match(/\.(gif|webp)(\?.*)?$/i)) {
    return "GIF";
  }

  return "IMAGE";
}
