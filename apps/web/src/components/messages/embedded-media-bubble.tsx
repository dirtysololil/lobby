"use client";

import { ExternalLink, ImageOff, X } from "lucide-react";
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
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [previewVideoFailed, setPreviewVideoFailed] = useState(false);
  const [viewerVideoFailed, setViewerVideoFailed] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const viewerVideoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLButtonElement | null>(null);
  const effectivePlayableUrl = playableUrl ?? null;
  const effectivePreviewUrl = previewUrl ?? posterUrl ?? null;
  const previewCanRenderVideo = !previewVideoFailed && Boolean(effectivePlayableUrl);
  const viewerCanRenderVideo = !viewerVideoFailed && Boolean(effectivePlayableUrl);
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
      { threshold: 0.35 },
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const node = previewVideoRef.current;

    if (!node || !previewCanRenderVideo) {
      return;
    }

    if (isInView && !isViewerOpen) {
      void node.play().catch(() => undefined);
      return;
    }

    node.pause();
  }, [isInView, isViewerOpen, previewCanRenderVideo]);

  useEffect(() => {
    if (!isViewerOpen) {
      viewerVideoRef.current?.pause();
      return;
    }

    function closeViewer() {
      setIsViewerOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeViewer();
        return;
      }

      if (event.key !== " " || kind !== "VIDEO") {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (target?.closest("button,a,input,textarea")) {
        return;
      }

      const video = viewerVideoRef.current;
      if (!video) {
        return;
      }

      event.preventDefault();
      if (video.paused) {
        void video.play().catch(() => undefined);
        return;
      }

      video.pause();
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      viewerVideoRef.current?.pause();
    };
  }, [isViewerOpen, kind]);

  const viewerMarkup =
    mounted && isViewerOpen
      ? createPortal(
          <div
            className="fixed inset-0 z-[120] bg-[rgba(3,6,10,0.82)] backdrop-blur-[8px]"
            onClick={() => setIsViewerOpen(false)}
          >
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <div
                className="relative flex w-full max-w-[min(96vw,1320px)] items-center justify-center"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="pointer-events-auto absolute right-0 top-[-52px] z-10 flex items-center gap-2">
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="dm-action-button"
                      aria-label="Открыть источник"
                      title="Открыть источник"
                    >
                      <ExternalLink size={15} strokeWidth={1.5} />
                    </a>
                  ) : null}
                  <button
                    type="button"
                    className="dm-action-button"
                    onClick={() => setIsViewerOpen(false)}
                    aria-label="Закрыть просмотр"
                    title="Закрыть просмотр"
                  >
                    <X size={15} strokeWidth={1.5} />
                  </button>
                </div>

                {kind === "VIDEO" && viewerCanRenderVideo && effectivePlayableUrl ? (
                  <video
                    ref={viewerVideoRef}
                    src={effectivePlayableUrl}
                    controls
                    playsInline
                    preload="metadata"
                    poster={posterUrl ?? effectivePreviewUrl ?? undefined}
                    onError={() => setViewerVideoFailed(true)}
                    className="block max-h-[calc(100vh-7rem)] w-auto max-w-full rounded-[18px] bg-black/35 shadow-[0_28px_70px_rgba(2,6,12,0.34)]"
                  />
                ) : effectivePreviewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={effectivePreviewUrl}
                    alt={label ?? ""}
                    loading="eager"
                    className="block max-h-[calc(100vh-6rem)] w-auto max-w-full rounded-[18px] object-contain shadow-[0_28px_70px_rgba(2,6,12,0.28)]"
                    draggable={false}
                  />
                ) : (
                  <div className="flex min-h-[320px] w-full max-w-[640px] items-center justify-center rounded-[24px] bg-[rgba(8,12,18,0.76)] text-center text-sm text-[var(--text-muted)] shadow-[0_24px_60px_rgba(2,6,12,0.3)]">
                    <div className="grid gap-2 px-6">
                      <ImageOff size={18} strokeWidth={1.5} className="mx-auto" />
                      <span>{fallbackLabel}</span>
                    </div>
                  </div>
                )}
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
        onClick={() => setIsViewerOpen(true)}
        className={cn(
          "group relative block aspect-square w-full overflow-hidden rounded-[24px] bg-[rgba(6,10,16,0.78)] text-left shadow-[0_16px_34px_rgba(4,8,16,0.24)] transition-transform hover:-translate-y-[1px]",
          className,
        )}
      >
        <PreviewSurface
          kind={kind}
          playableUrl={effectivePlayableUrl}
          previewUrl={effectivePreviewUrl}
          posterUrl={posterUrl}
          videoRef={previewVideoRef}
          allowVideo={previewCanRenderVideo}
          forcePlay={isInView && !isViewerOpen}
          onVideoError={() => setPreviewVideoFailed(true)}
          className="h-full w-full"
          mediaClassName="h-full w-full object-cover"
          fallbackLabel={fallbackLabel}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-[linear-gradient(180deg,transparent,rgba(4,8,14,0.74))] px-3 pb-3 pt-10">
          <span className="rounded-full bg-black/35 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-white/82">
            {label ?? (kind === "VIDEO" ? "Видео" : "Медиа")}
          </span>
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/30 text-white/60">
            <ExternalLink size={12} strokeWidth={1.5} />
          </span>
        </div>
      </button>
      {viewerMarkup}
    </>
  );
}

function PreviewSurface(args: {
  kind: "IMAGE" | "VIDEO" | "GIF";
  playableUrl: string | null;
  previewUrl: string | null;
  posterUrl: string | null;
  videoRef?: RefObject<HTMLVideoElement | null>;
  allowVideo: boolean;
  forcePlay: boolean;
  onVideoError: () => void;
  className?: string;
  mediaClassName?: string;
  fallbackLabel: string;
}) {
  const shouldRenderVideo = useMemo(() => {
    if (!args.playableUrl || !args.allowVideo) {
      return false;
    }

    return (
      args.kind === "VIDEO" ||
      args.kind === "GIF" ||
      /\.(mp4|webm|webp)(\?.*)?$/i.test(args.playableUrl)
    );
  }, [args.allowVideo, args.kind, args.playableUrl]);

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
