"use client";

import type { DmLinkEmbed } from "@lobby/shared";
import { ExternalLink, LoaderCircle, PlayCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface LinkEmbedCardProps {
  embed: DmLinkEmbed;
  className?: string;
}

export function LinkEmbedCard({ embed, className }: LinkEmbedCardProps) {
  const href = embed.canonicalUrl ?? embed.sourceUrl;

  if (embed.status === "FAILED") {
    return null;
  }

  if (embed.status === "PENDING") {
    return (
      <div
        className={cn(
          "overflow-hidden rounded-[18px] border border-white/8 bg-white/[0.035]",
          className,
        )}
      >
        <div className="aspect-[16/10] animate-pulse bg-[linear-gradient(135deg,rgba(106,168,248,0.08),rgba(255,255,255,0.03)_46%,rgba(255,255,255,0.015))]" />
        <div className="flex items-center gap-2 border-t border-white/6 px-3 py-2 text-xs text-[var(--text-muted)]">
          <LoaderCircle size={14} strokeWidth={1.5} className="animate-spin" />
          Подтягиваем превью Tenor...
        </div>
      </div>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "group block overflow-hidden rounded-[18px] border border-white/8 bg-white/[0.035] transition-colors hover:border-white/12 hover:bg-white/[0.05]",
        className,
      )}
    >
      <LinkEmbedMedia embed={embed} />
      <div className="flex items-center justify-between gap-3 border-t border-white/6 px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">
            {embed.title || "Tenor"}
          </p>
          <p className="mt-0.5 truncate text-[11px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
            {embed.provider}
          </p>
        </div>
        <ExternalLink
          size={16}
          strokeWidth={1.5}
          className="shrink-0 text-[var(--text-muted)] transition-colors group-hover:text-white"
        />
      </div>
    </a>
  );
}

function LinkEmbedMedia({ embed }: { embed: DmLinkEmbed }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isInView, setIsInView] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const ratio = useMemo(() => {
    if (embed.aspectRatio && embed.aspectRatio > 0) {
      return embed.aspectRatio;
    }

    if (embed.width && embed.height && embed.width > 0 && embed.height > 0) {
      return embed.width / embed.height;
    }

    return 16 / 10;
  }, [embed.aspectRatio, embed.height, embed.width]);
  const mediaPadding = `${Math.max(36, Math.min(90, 100 / ratio))}%`;
  const showVideo =
    !videoFailed &&
    Boolean(embed.animatedMediaUrl) &&
    Boolean(embed.contentType?.startsWith("video/"));

  useEffect(() => {
    const node = containerRef.current;

    if (!node || typeof IntersectionObserver === "undefined") {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        setIsInView(entries.some((entry) => entry.isIntersecting));
      },
      {
        threshold: 0.35,
      },
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const node = videoRef.current;

    if (!node || !showVideo) {
      return;
    }

    if (isInView) {
      void node.play().catch(() => undefined);
      return;
    }

    node.pause();
  }, [isInView, showVideo]);

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden bg-[radial-gradient(circle_at_top,rgba(106,168,248,0.12),transparent_60%),rgba(6,10,16,0.72)]"
      style={{ paddingBottom: mediaPadding }}
    >
      {showVideo && embed.animatedMediaUrl ? (
        <video
          ref={videoRef}
          src={embed.animatedMediaUrl}
          muted
          loop
          playsInline
          preload="metadata"
          poster={embed.previewImage ?? undefined}
          onError={() => setVideoFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : embed.previewImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={embed.previewImage}
          alt={embed.title || "Tenor"}
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="absolute inset-0 bg-white/[0.03]" />
      )}

      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-[linear-gradient(180deg,transparent,rgba(4,8,14,0.72))] px-3 pb-3 pt-8 text-[11px] text-white/80">
        <span className="rounded-full border border-white/10 bg-black/25 px-2 py-1 uppercase tracking-[0.14em] text-[10px]">
          Tenor
        </span>
        {showVideo ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/25 px-2 py-1">
            <PlayCircle size={12} strokeWidth={1.5} />
            loop
          </span>
        ) : null}
      </div>
    </div>
  );
}
