"use client";

import {
  ImageOff,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Volume1,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
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

type ViewerAudioState = {
  muted: boolean;
  volume: number;
};

const viewerAudioStorageKey = "lobby:dm:viewer-audio";
const defaultViewerAudioState: ViewerAudioState = {
  muted: false,
  volume: 0.8,
};

export function EmbeddedMediaBubble({
  kind,
  previewUrl = null,
  playableUrl = null,
  posterUrl = null,
  label = null,
  className,
}: EmbeddedMediaBubbleProps) {
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [previewVideoFailed, setPreviewVideoFailed] = useState(false);
  const [viewerVideoFailed, setViewerVideoFailed] = useState(false);
  const [isInView, setIsInView] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }

    return typeof IntersectionObserver === "undefined";
  });
  const [isViewerPlaying, setIsViewerPlaying] = useState(false);
  const [isViewerFullscreen, setIsViewerFullscreen] = useState(false);
  const [viewerCurrentTime, setViewerCurrentTime] = useState(0);
  const [viewerDuration, setViewerDuration] = useState(0);
  const [viewerAudio, setViewerAudio] = useState<ViewerAudioState>(() =>
    readStoredViewerAudioState(),
  );
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const viewerVideoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLButtonElement | null>(null);
  const viewerShellRef = useRef<HTMLDivElement | null>(null);
  const lastAudibleVolumeRef = useRef(
    defaultViewerAudioState.volume > 0
      ? defaultViewerAudioState.volume
      : 0.8,
  );
  const effectivePlayableUrl = playableUrl ?? null;
  const effectivePreviewUrl = previewUrl ?? posterUrl ?? null;
  const previewCanRenderVideo = !previewVideoFailed && Boolean(effectivePlayableUrl);
  const viewerCanRenderVideo = !viewerVideoFailed && Boolean(effectivePlayableUrl);
  const isVideoViewer =
    kind === "VIDEO" && viewerCanRenderVideo && Boolean(effectivePlayableUrl);
  const fallbackLabel =
    kind === "VIDEO" ? "Видео недоступно" : "Медиа недоступно";

  useEffect(() => {
    if (viewerAudio.volume > 0) {
      lastAudibleVolumeRef.current = viewerAudio.volume;
    }
  }, [viewerAudio.volume]);

  useEffect(() => {
    const node = containerRef.current;

    if (!node || typeof IntersectionObserver === "undefined") {
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

  const resetViewerState = useCallback(() => {
    setIsViewerPlaying(false);
    setIsViewerFullscreen(false);
    setViewerCurrentTime(0);
    setViewerDuration(0);
  }, []);

  const openViewer = useCallback(() => {
    resetViewerState();
    setIsViewerOpen(true);
  }, [resetViewerState]);

  const closeViewer = useCallback(() => {
    viewerVideoRef.current?.pause();

    if (
      typeof document !== "undefined" &&
      document.fullscreenElement === viewerShellRef.current
    ) {
      void document.exitFullscreen().catch(() => undefined);
    }

    resetViewerState();
    setIsViewerOpen(false);
  }, [resetViewerState]);

  useEffect(() => {
    if (!isViewerOpen) {
      return;
    }

    function handleFullscreenChange() {
      setIsViewerFullscreen(
        typeof document !== "undefined" &&
          document.fullscreenElement === viewerShellRef.current,
      );
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
    const viewerVideo = viewerVideoRef.current;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      viewerVideo?.pause();
    };
  }, [closeViewer, isViewerOpen, kind]);

  useEffect(() => {
    if (!isViewerOpen || !isVideoViewer) {
      return;
    }

    const video = viewerVideoRef.current;

    if (!video) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      void video.play().catch(() => undefined);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [isVideoViewer, isViewerOpen]);

  useEffect(() => {
    if (!isViewerOpen || !isVideoViewer) {
      return;
    }

    const video = viewerVideoRef.current;

    if (!video) {
      return;
    }

    video.volume = viewerAudio.volume;
    video.muted = viewerAudio.muted;
  }, [isVideoViewer, isViewerOpen, viewerAudio.muted, viewerAudio.volume]);

  const syncViewerAudio = useCallback((nextAudio: ViewerAudioState) => {
    const resolvedAudio = {
      muted: nextAudio.muted,
      volume: clampViewerVolume(nextAudio.volume),
    };

    if (!resolvedAudio.muted && resolvedAudio.volume > 0) {
      lastAudibleVolumeRef.current = resolvedAudio.volume;
    }

    setViewerAudio(resolvedAudio);
    writeStoredViewerAudioState(resolvedAudio);

    const video = viewerVideoRef.current;

    if (video) {
      video.volume = resolvedAudio.volume;
      video.muted = resolvedAudio.muted;
    }
  }, []);

  function handleViewerTimeUpdate() {
    const video = viewerVideoRef.current;

    if (!video) {
      return;
    }

    setViewerCurrentTime(video.currentTime);
  }

  function handleViewerDurationChange() {
    const video = viewerVideoRef.current;

    if (!video) {
      return;
    }

    setViewerDuration(Number.isFinite(video.duration) ? video.duration : 0);
  }

  function handleViewerLoadedMetadata() {
    const video = viewerVideoRef.current;

    if (!video) {
      return;
    }

    setViewerDuration(Number.isFinite(video.duration) ? video.duration : 0);
    setViewerCurrentTime(video.currentTime);
    video.volume = viewerAudio.volume;
    video.muted = viewerAudio.muted;
    void video.play().catch(() => undefined);
  }

  function handleViewerVolumeChange() {
    const video = viewerVideoRef.current;

    if (!video) {
      return;
    }

    const nextAudio = {
      muted: video.muted,
      volume: clampViewerVolume(video.volume),
    };

    if (
      nextAudio.muted === viewerAudio.muted &&
      nextAudio.volume === viewerAudio.volume
    ) {
      return;
    }

    if (!nextAudio.muted && nextAudio.volume > 0) {
      lastAudibleVolumeRef.current = nextAudio.volume;
    }

    setViewerAudio(nextAudio);
    writeStoredViewerAudioState(nextAudio);
  }

  function toggleViewerPlayback() {
    const video = viewerVideoRef.current;

    if (!video) {
      return;
    }

    if (video.paused) {
      void video.play().catch(() => undefined);
      return;
    }

    video.pause();
  }

  function handleViewerSeek(nextTime: number) {
    const video = viewerVideoRef.current;

    if (!video) {
      return;
    }

    const resolvedTime = Math.min(
      Math.max(0, nextTime),
      Number.isFinite(video.duration) ? video.duration : nextTime,
    );
    video.currentTime = resolvedTime;
    setViewerCurrentTime(resolvedTime);
  }

  function handleViewerVolumeInput(nextValue: number) {
    const nextVolume = clampViewerVolume(nextValue);
    syncViewerAudio({
      muted: nextVolume === 0,
      volume: nextVolume,
    });
  }

  function toggleViewerMute() {
    if (viewerAudio.muted || viewerAudio.volume === 0) {
      syncViewerAudio({
        muted: false,
        volume:
          viewerAudio.volume > 0
            ? viewerAudio.volume
            : lastAudibleVolumeRef.current || defaultViewerAudioState.volume,
      });
      return;
    }

    syncViewerAudio({
      muted: true,
      volume: viewerAudio.volume,
    });
  }

  async function toggleViewerFullscreen() {
    const shell = viewerShellRef.current;

    if (!shell || typeof document === "undefined") {
      return;
    }

    if (document.fullscreenElement === shell) {
      await document.exitFullscreen().catch(() => undefined);
      return;
    }

    if (typeof shell.requestFullscreen !== "function") {
      return;
    }

    await shell.requestFullscreen().catch(() => undefined);
  }

  const viewerMarkup =
    typeof document !== "undefined" && isViewerOpen
      ? createPortal(
          <div
            className="fixed inset-0 z-[120] bg-[rgba(4,7,11,0.88)] backdrop-blur-[10px]"
            onClick={closeViewer}
          >
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <div
                className="pointer-events-auto dm-viewer-shell inline-flex max-w-full flex-col items-end gap-3"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="dm-viewer-toolbar">
                  <button
                    type="button"
                    className="dm-viewer-action"
                    onClick={closeViewer}
                    aria-label="Закрыть просмотр"
                    title="Закрыть просмотр"
                  >
                    <X size={15} strokeWidth={1.5} />
                    <span className="dm-viewer-action-label">Закрыть</span>
                  </button>
                </div>

                <div className="dm-viewer-stage">
                  {isVideoViewer && effectivePlayableUrl ? (
                    <div ref={viewerShellRef} className="dm-viewer-video-shell">
                      <button
                        type="button"
                        className="dm-viewer-video-stage"
                        onClick={toggleViewerPlayback}
                        aria-label={
                          isViewerPlaying
                            ? "Поставить видео на паузу"
                            : "Воспроизвести видео"
                        }
                      >
                        <video
                          ref={viewerVideoRef}
                          src={effectivePlayableUrl}
                          autoPlay
                          playsInline
                          preload="auto"
                          poster={posterUrl ?? effectivePreviewUrl ?? undefined}
                          onError={() => setViewerVideoFailed(true)}
                          onLoadedMetadata={handleViewerLoadedMetadata}
                          onDurationChange={handleViewerDurationChange}
                          onTimeUpdate={handleViewerTimeUpdate}
                          onPlay={() => setIsViewerPlaying(true)}
                          onPause={() => setIsViewerPlaying(false)}
                          onVolumeChange={handleViewerVolumeChange}
                          className="dm-viewer-media dm-viewer-video max-h-[calc(100vh-13rem)] w-auto"
                        />
                        {!isViewerPlaying ? (
                          <span className="dm-viewer-video-overlay-play" aria-hidden="true">
                            <span className="dm-viewer-video-overlay-icon">
                              <Play size={24} strokeWidth={1.7} />
                            </span>
                          </span>
                        ) : null}
                      </button>

                      <div className="dm-viewer-video-controls">
                        <input
                          type="range"
                          min={0}
                          max={viewerDuration || 0}
                          step={0.1}
                          value={Math.min(viewerCurrentTime, viewerDuration || 0)}
                          onChange={(event) =>
                            handleViewerSeek(Number(event.currentTarget.value))
                          }
                          className="dm-viewer-range dm-viewer-progress"
                          aria-label="Позиция видео"
                        />

                        <div className="dm-viewer-video-controls-row">
                          <div className="dm-viewer-video-controls-group">
                            <button
                              type="button"
                              className="dm-viewer-action dm-viewer-action-compact"
                              onClick={toggleViewerPlayback}
                              aria-label={
                                isViewerPlaying
                                  ? "Поставить видео на паузу"
                                  : "Воспроизвести видео"
                              }
                              title={
                                isViewerPlaying
                                  ? "Поставить на паузу"
                                  : "Воспроизвести"
                              }
                            >
                              {isViewerPlaying ? (
                                <Pause size={16} strokeWidth={1.6} />
                              ) : (
                                <Play size={16} strokeWidth={1.6} />
                              )}
                            </button>

                            <span className="dm-viewer-time">
                              {formatMediaTime(viewerCurrentTime)} /{" "}
                              {formatMediaTime(viewerDuration)}
                            </span>
                          </div>

                          <div className="dm-viewer-video-controls-group dm-viewer-video-controls-group-end">
                            <div className="dm-viewer-volume">
                              <button
                                type="button"
                                className="dm-viewer-action dm-viewer-action-compact"
                                onClick={toggleViewerMute}
                                aria-label={
                                  viewerAudio.muted || viewerAudio.volume === 0
                                    ? "Включить звук"
                                    : "Выключить звук"
                                }
                                title={
                                  viewerAudio.muted || viewerAudio.volume === 0
                                    ? "Включить звук"
                                    : "Выключить звук"
                                }
                              >
                                {viewerAudio.muted || viewerAudio.volume === 0 ? (
                                  <VolumeX size={16} strokeWidth={1.6} />
                                ) : viewerAudio.volume < 0.5 ? (
                                  <Volume1 size={16} strokeWidth={1.6} />
                                ) : (
                                  <Volume2 size={16} strokeWidth={1.6} />
                                )}
                              </button>

                              <input
                                type="range"
                                min={0}
                                max={1}
                                step={0.05}
                                value={viewerAudio.muted ? 0 : viewerAudio.volume}
                                onChange={(event) =>
                                  handleViewerVolumeInput(
                                    Number(event.currentTarget.value),
                                  )
                                }
                                className="dm-viewer-range dm-viewer-volume-range"
                                aria-label="Громкость"
                              />
                            </div>

                            <button
                              type="button"
                              className="dm-viewer-action dm-viewer-action-compact"
                              onClick={() => void toggleViewerFullscreen()}
                              aria-label={
                                isViewerFullscreen
                                  ? "Выйти из полного экрана"
                                  : "Открыть в полном экране"
                              }
                              title={
                                isViewerFullscreen
                                  ? "Выйти из полного экрана"
                                  : "Полный экран"
                              }
                            >
                              {isViewerFullscreen ? (
                                <Minimize2 size={16} strokeWidth={1.6} />
                              ) : (
                                <Maximize2 size={16} strokeWidth={1.6} />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : effectivePreviewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={effectivePreviewUrl}
                      alt={label ?? ""}
                      loading="eager"
                      className="dm-viewer-media max-h-[calc(100vh-7.5rem)] w-auto object-contain"
                      draggable={false}
                    />
                  ) : (
                    <div className="flex min-h-[320px] w-full max-w-[640px] items-center justify-center rounded-[24px] bg-[rgba(8,12,18,0.5)] text-center text-sm text-[var(--text-muted)]">
                      <div className="grid gap-2 px-6">
                        <ImageOff size={18} strokeWidth={1.5} className="mx-auto" />
                        <span>{fallbackLabel}</span>
                      </div>
                    </div>
                  )}
                </div>
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
        onClick={openViewer}
        className={cn(
          "block aspect-square w-full overflow-hidden rounded-[12px] bg-transparent text-left transition-opacity hover:opacity-[0.98]",
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
      </button>
      {viewerMarkup}
    </>
  );
}

function clampViewerVolume(value: number) {
  if (!Number.isFinite(value)) {
    return defaultViewerAudioState.volume;
  }

  return Math.min(1, Math.max(0, value));
}

function readStoredViewerAudioState(): ViewerAudioState {
  if (typeof window === "undefined") {
    return defaultViewerAudioState;
  }

  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(viewerAudioStorageKey) ?? "null",
    ) as Partial<ViewerAudioState> | null;

    return {
      muted: Boolean(parsed?.muted),
      volume: clampViewerVolume(parsed?.volume ?? defaultViewerAudioState.volume),
    };
  } catch {
    return defaultViewerAudioState;
  }
}

function writeStoredViewerAudioState(value: ViewerAudioState) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      viewerAudioStorageKey,
      JSON.stringify({
        muted: value.muted,
        volume: clampViewerVolume(value.volume),
      }),
    );
  } catch {
    // Ignore localStorage access issues and keep the player working.
  }
}

function formatMediaTime(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    return "0:00";
  }

  const totalSeconds = Math.floor(value);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function PreviewSurface({
  kind,
  playableUrl,
  previewUrl,
  posterUrl,
  videoRef,
  allowVideo,
  forcePlay,
  onVideoError,
  className,
  mediaClassName,
  fallbackLabel,
}: {
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
    if (!playableUrl || !allowVideo) {
      return false;
    }

    return (
      kind === "VIDEO" ||
      kind === "GIF" ||
      /\.(mp4|webm|webp)(\?.*)?$/i.test(playableUrl)
    );
  }, [allowVideo, kind, playableUrl]);

  useEffect(() => {
    const node = videoRef?.current;

    if (!node || !shouldRenderVideo) {
      return;
    }

    if (forcePlay) {
      void node.play().catch(() => undefined);
      return;
    }

    node.pause();
  }, [forcePlay, shouldRenderVideo, videoRef]);

  if (shouldRenderVideo && playableUrl) {
    return (
      <div className={cn("relative overflow-hidden", className)}>
        <video
          ref={videoRef}
          src={playableUrl}
          muted
          loop
          playsInline
          preload="metadata"
          poster={posterUrl ?? previewUrl ?? undefined}
          onError={onVideoError}
          className={cn("block", mediaClassName)}
        />
      </div>
    );
  }

  if (previewUrl) {
    return (
      <div className={cn("relative overflow-hidden", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewUrl}
          alt=""
          loading="lazy"
          className={cn("block", mediaClassName)}
          draggable={false}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex h-full w-full items-center justify-center bg-white/[0.03] text-center text-xs text-[var(--text-muted)]",
        className,
      )}
    >
      <div className="grid gap-2 px-4">
        <ImageOff size={18} strokeWidth={1.5} className="mx-auto" />
        <span>{fallbackLabel}</span>
      </div>
    </div>
  );
}
