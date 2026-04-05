"use client";

import { Monitor, MonitorOff, Play, Users2 } from "lucide-react";
import { Track } from "livekit-client";
import { useEffect, useMemo, useState } from "react";
import { TrackSurface, type TrackView } from "@/components/calls/call-session-provider";
import { Button } from "@/components/ui/button";
import { PreviewShell } from "../_preview-shell";
import { previewLeo, previewViewer } from "../_mock-data";

function buildPreviewTrackView(args: {
  id: string;
  isLocal: boolean;
  mediaTrack: MediaStreamTrack;
  participantId: string;
  participantName: string;
}): TrackView {
  return {
    id: args.id,
    participantId: args.participantId,
    participantName: args.participantName,
    source: Track.Source.ScreenShare,
    kind: "video",
    isLocal: args.isLocal,
    track: ({
      kind: Track.Kind.Video,
      source: Track.Source.ScreenShare,
      attach(element?: HTMLMediaElement) {
        const target =
          element instanceof HTMLVideoElement ? element : document.createElement("video");
        target.srcObject = new MediaStream([args.mediaTrack]);
        return target;
      },
      detach(element?: HTMLMediaElement) {
        if (element) {
          element.srcObject = null;
        }

        return [];
      },
    } as unknown) as Track,
  };
}

export default function PreviewScreenShareLabPage() {
  const [localTrack, setLocalTrack] = useState<MediaStreamTrack | null>(null);
  const [remoteTrack, setRemoteTrack] = useState<MediaStreamTrack | null>(null);
  const [pending, setPending] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const localView = useMemo(
    () =>
      localTrack
        ? buildPreviewTrackView({
            id: `local:${localTrack.id}`,
            isLocal: true,
            mediaTrack: localTrack,
            participantId: previewViewer.id,
            participantName: previewViewer.profile.displayName,
          })
        : null,
    [localTrack],
  );

  const remoteView = useMemo(
    () =>
      remoteTrack
        ? buildPreviewTrackView({
            id: `remote:${remoteTrack.id}`,
            isLocal: false,
            mediaTrack: remoteTrack,
            participantId: previewLeo.id,
            participantName: previewLeo.profile.displayName,
          })
        : null,
    [remoteTrack],
  );

  const screenShareVisible = Boolean(localView && remoteView);

  function pushLog(message: string) {
    setLogs((current) => [message, ...current].slice(0, 18));
  }

  function stopSharing() {
    localTrack?.stop();
    remoteTrack?.stop();
    setLocalTrack(null);
    setRemoteTrack(null);
    pushLog("stop/unpublish cleanup complete");
  }

  async function startSharing() {
    setPending(true);
    pushLog("click on share button");

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        audio: false,
        video: {
          displaySurface: "browser",
        },
      });
      const sourceTrack = stream.getVideoTracks()[0] ?? null;

      if (!sourceTrack) {
        pushLog("getDisplayMedia success but no video track");
        stopSharing();
        return;
      }

      const clonedTrack = sourceTrack.clone();
      sourceTrack.addEventListener("ended", () => {
        pushLog("source track ended");
        stopSharing();
      });
      setLocalTrack(sourceTrack);
      setRemoteTrack(clonedTrack);
      pushLog(`getDisplayMedia success -> local track ${sourceTrack.id}`);
      pushLog(`simulated remote track clone -> ${clonedTrack.id}`);
    } catch (error) {
      pushLog(
        `getDisplayMedia failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setPending(false);
    }
  }

  useEffect(() => {
    return () => {
      localTrack?.stop();
      remoteTrack?.stop();
    };
  }, [localTrack, remoteTrack]);

  return (
    <PreviewShell
      viewer={previewViewer}
      sectionLabel="Preview"
      rows={[
        {
          id: "screen-share-lab",
          label: "Screen Share Lab",
          detail: "Manual browser verification of capture and stage rendering.",
          active: true,
          meta: (
            <span className="glass-badge">
              <Monitor size={18} strokeWidth={1.5} />
              Lab
            </span>
          ),
        },
      ]}
    >
      <div className="flex min-h-screen flex-col px-4 py-4">
        <div className="premium-panel rounded-[28px] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="eyebrow-pill">Screen Share Lab</span>
                <span className="status-pill">
                  <Users2 size={16} strokeWidth={1.5} />
                  Local + remote preview
                </span>
                {screenShareVisible ? (
                  <span className="status-pill">
                    <Monitor size={16} strokeWidth={1.5} />
                    Visible
                  </span>
                ) : (
                  <span className="status-pill">
                    <MonitorOff size={16} strokeWidth={1.5} />
                    Idle
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm text-[var(--text-dim)]">
                Эта сцена использует настоящий `getDisplayMedia()` и тот же `TrackSurface`,
                что и call UI.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => void startSharing()}
                disabled={pending}
                data-testid="screen-share-start"
              >
                <Play size={16} strokeWidth={1.5} />
                {pending ? "Запрашиваем экран..." : "Показать экран"}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => stopSharing()}
                disabled={!localTrack && !remoteTrack}
                data-testid="screen-share-stop"
              >
                <MonitorOff size={16} strokeWidth={1.5} />
                Остановить
              </Button>
            </div>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4">
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-white">Local sharer</p>
                  {localView ? (
                    <div data-testid="local-screen-surface">
                      <TrackSurface item={localView} emphasis="conversation" expanded />
                    </div>
                  ) : (
                    <div
                      data-testid="local-screen-empty"
                      className="flex min-h-[260px] items-center justify-center rounded-[20px] border border-white/6 bg-black/10 text-sm text-[var(--text-dim)]"
                    >
                      Capture not started
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-white">Remote viewer</p>
                  {remoteView ? (
                    <div data-testid="remote-screen-surface">
                      <TrackSurface item={remoteView} emphasis="conversation" expanded />
                    </div>
                  ) : (
                    <div
                      data-testid="remote-screen-empty"
                      className="flex min-h-[260px] items-center justify-center rounded-[20px] border border-white/6 bg-black/10 text-sm text-[var(--text-dim)]"
                    >
                      Waiting for cloned remote track
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="surface-subtle rounded-[22px] p-3">
                <p className="text-sm font-medium text-white">State</p>
                <div className="mt-3 grid gap-2 text-sm text-[var(--text-dim)]">
                  {[
                    ["screenShareVisible", String(screenShareVisible)],
                    ["localTrack", localTrack?.id ?? "none"],
                    ["remoteTrack", remoteTrack?.id ?? "none"],
                    ["pending", String(pending)],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      data-testid={`state-${label}`}
                      className="flex items-center justify-between gap-3 rounded-[16px] border border-white/6 bg-black/10 px-3 py-2.5"
                    >
                      <span>{label}</span>
                      <span className="text-[var(--text-soft)]">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="surface-subtle rounded-[22px] p-3">
                <p className="text-sm font-medium text-white">Diagnostics</p>
                <div className="mt-3 grid gap-2">
                  {logs.length > 0 ? (
                    logs.map((line) => (
                      <div
                        key={line}
                        className="rounded-[14px] border border-white/6 bg-black/10 px-3 py-2 text-xs text-[var(--text-dim)]"
                      >
                        {line}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[14px] border border-white/6 bg-black/10 px-3 py-2 text-xs text-[var(--text-dim)]">
                      No events yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PreviewShell>
  );
}
