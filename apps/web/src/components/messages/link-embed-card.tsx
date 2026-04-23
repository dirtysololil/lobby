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
  const createdAtTimestamp = messageCreatedAt
    ? new Date(messageCreatedAt).getTime()
    : null;
  const pendingExpiresAt =
    createdAtTimestamp === null
      ? null
      : createdAtTimestamp + pendingStaleAfterMs;
  const [expiredPendingAt, setExpiredPendingAt] = useState<number | null>(null);
  const isPendingVisible =
    embed.status !== "PENDING" ||
    pendingExpiresAt === null ||
    expiredPendingAt !== pendingExpiresAt;

  useEffect(() => {
    if (embed.status !== "PENDING" || pendingExpiresAt === null) {
      return;
    }

    const expiresInMs = Math.max(pendingExpiresAt - Date.now(), 0);
    const timer = window.setTimeout(() => {
      setExpiredPendingAt(pendingExpiresAt);
    }, expiresInMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [embed.status, pendingExpiresAt]);

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
          "overflow-hidden rounded-[24px] border border-white/8 bg-black",
          className,
        )}
      >
        <div className="aspect-square animate-pulse bg-white/[0.04]" />
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
      aspectRatio={
        embed.aspectRatio ??
        (embed.width && embed.height ? embed.width / embed.height : null)
      }
      mediaFit="contain"
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
