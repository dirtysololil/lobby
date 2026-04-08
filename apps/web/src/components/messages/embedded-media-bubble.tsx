"use client";

import { ExternalLink, Film, ImageOff } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

interface EmbeddedMediaBubbleProps {
  kind: "IMAGE" | "VIDEO" | "GIF";
  previewUrl?: string | null;
  playableUrl?: string | null;
  posterUrl?: string | null;
  href?: string | null;
  label?: string | null;
  className?: string;
}

export function EmbeddedMediaBubble({
  kind,
  previewUrl = null,
  playableUrl = null,
  posterUrl = null,
  href = null,
  label = null,
  className,
}: EmbeddedMediaBubbleProps) {
  const [mounted, setMounted] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLButtonElement | null>(null);
  const effectivePlayableUrl = playableUrl ?? null;
  const effectivePreviewUrl = previewUrl ?? posterUrl ?? null;
  const showVideo = !videoFailed && Boolean(effectivePlayableUrl);
  const fallbackLabel =
    kind === "VIDEO" ? "Видео недоступно" : "Медиа недоступно";

  useEffect(() => {
    setMounted(true);
  }, []);

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

  const lightboxMarkup =
    mounted && isLightboxOpen
      ? createPortal(
          <div
            className="fixed inset-0 z-[110] flex items-center justify-center bg-[rgba(3,6,10,0.88)] p-4 backdrop-blur-md"
            onClick={() => setIsLightboxOpen(false)}
          >
            <div
              className="relative max-h-[88vh] w-full max-w-[min(82vw,720px)] overflow-hidden rounded-[28px] border border-white/10 bg-[rgba(10,14,20,0.98)] shadow-[0_28px_80px_rgba(2,6,12,0.52)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/35 text-white/80 transition-colors hover:text-white"
                    aria-label="Открыть источник"
                  >
                    <ExternalLink size={16} strokeWidth={1.5} />
                  </a>
                ) : null}
              </div>
              <div className="max-h-[88vh]">
                <MediaSurface
                  kind={kind}
                  playableUrl={effectivePlayableUrl}
                  previewUrl={effectivePreviewUrl}
                  posterUrl={posterUrl}
                  videoRef={undefined}
                  forcePlay
                  onVideoError={() => setVideoFailed(true)}
                  className="aspect-auto max-h-[88vh] min-h-[320px] bg-[rgba(6,10,16,0.88)]"
                  mediaClassName="max-h-[88vh] object-contain"
                  fallbackLabel={fallbackLabel}
                />
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={containerRef}
        type="button"
        onClick={() => setIsLightboxOpen(true)}
        className={cn(
          "group relative block aspect-square w-full overflow-hidden rounded-[24px] border border-white/8 bg-[radial-gradient(circle_at_top,rgba(106,168,248,0.12),transparent_58%),rgba(6,10,16,0.78)] text-left transition-colors hover:border-white/14",
          className,
        )}
      >
        <MediaSurface
          kind={kind}
          playableUrl={effectivePlayableUrl}
          previewUrl={effectivePreviewUrl}
          posterUrl={posterUrl}
          videoRef={videoRef}
          forcePlay={isInView}
          onVideoError={() => setVideoFailed(true)}
          className="h-full w-full"
          mediaClassName="h-full w-full object-cover"
          fallbackLabel={fallbackLabel}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-[linear-gradient(180deg,transparent,rgba(4,8,14,0.8))] px-3 pb-3 pt-10">
          <span className="rounded-full border border-white/10 bg-black/35 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-white/85">
            {label ?? (kind === "VIDEO" ? "Видео" : "Медиа")}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/35 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-white/70">
            <Film size={12} strokeWidth={1.5} />
            открыть
          </span>
        </div>
      </button>
      {lightboxMarkup}
    </>
  );
}

function MediaSurface(args: {
  kind: "IMAGE" | "VIDEO" | "GIF";
  playableUrl: string | null;
  previewUrl: string | null;
  posterUrl: string | null;
  videoRef?: RefObject<HTMLVideoElement | null>;
  forcePlay: boolean;
  onVideoError: () => void;
  className?: string;
  mediaClassName?: string;
  fallbackLabel: string;
}) {
  const shouldRenderVideo = useMemo(() => {
    if (!args.playableUrl) {
      return false;
    }

    return (
      args.kind === "VIDEO" ||
      args.kind === "GIF" ||
      /\.(mp4|webm|webp)(\?.*)?$/i.test(args.playableUrl)
    );
  }, [args.kind, args.playableUrl]);

  useEffect(() => {
    const node = args.videoRef?.current;

    if (!node || !shouldRenderVideo) {
      return;
    }

    if (args.forcePlay) {
      void node.play().catch(() => undefined);
      return;
    }

    node.pause();
  }, [args.forcePlay, args.videoRef, shouldRenderVideo]);

  if (shouldRenderVideo && args.playableUrl) {
    return (
      <div className={cn("relative overflow-hidden", args.className)}>
        <video
          ref={args.videoRef}
          src={args.playableUrl}
          muted
          loop
          playsInline
          preload="metadata"
          poster={args.posterUrl ?? args.previewUrl ?? undefined}
          onError={args.onVideoError}
          className={cn("block", args.mediaClassName)}
        />
      </div>
    );
  }

  if (args.previewUrl) {
    return (
      <div className={cn("relative overflow-hidden", args.className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={args.previewUrl}
          alt=""
          loading="lazy"
          className={cn("block", args.mediaClassName)}
          draggable={false}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex h-full w-full items-center justify-center bg-white/[0.03] text-center text-xs text-[var(--text-muted)]",
        args.className,
      )}
    >
      <div className="grid gap-2 px-4">
        <ImageOff size={18} strokeWidth={1.5} className="mx-auto" />
        <span>{args.fallbackLabel}</span>
      </div>
    </div>
  );
}
