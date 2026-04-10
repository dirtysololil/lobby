"use client";

import { Camera, Circle, LoaderCircle, Square, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { buildVideoNoteFileName } from "@/lib/direct-message-video-notes";
import { cn } from "@/lib/utils";

type VideoNoteRecorderStatus =
  | "preparing"
  | "ready"
  | "recording"
  | "processing"
  | "fallback";

interface VideoNoteRecorderProps {
  disabled: boolean;
  onClose: () => void;
  onSend: (file: File) => Promise<void>;
}

const preferredRecorderMimeTypes = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
  "video/mp4",
] as const;

export function VideoNoteRecorder({
  disabled,
  onClose,
  onSend,
}: VideoNoteRecorderProps) {
  const [status, setStatus] = useState<VideoNoteRecorderStatus>("preparing");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [recordingDurationMs, setRecordingDurationMs] = useState(0);
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);
  const previewRef = useRef<HTMLVideoElement | null>(null);
  const captureInputRef = useRef<HTMLInputElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const activeStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const chosenMimeTypeRef = useRef<string | null>(null);
  const recordingStartedAtRef = useRef<number | null>(null);
  const discardRecordingRef = useRef(false);

  const resetRecordingSession = useCallback(() => {
    recorderRef.current = null;
    chunksRef.current = [];
    chosenMimeTypeRef.current = null;
    recordingStartedAtRef.current = null;
    discardRecordingRef.current = false;
    setRecordingDurationMs(0);
  }, []);

  const cleanupRecorder = useCallback(() => {
    resetRecordingSession();
    stopMediaStream(activeStreamRef.current);
    activeStreamRef.current = null;
    setActiveStream(null);
  }, [resetRecordingSession]);

  const handleClose = useCallback(async () => {
    if (status === "processing") {
      return;
    }

    const recorder = recorderRef.current;

    if (recorder && recorder.state !== "inactive") {
      discardRecordingRef.current = true;
      setStatus("processing");
      recorder.stop();
      return;
    }

    cleanupRecorder();
    onClose();
  }, [cleanupRecorder, onClose, status]);

  useEffect(() => {
    let active = true;

    async function prepareRecorder() {
      if (!supportsLiveVideoNotes()) {
        if (active) {
          setStatus("fallback");
        }
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: {
            facingMode: "user",
            width: { ideal: 720 },
            height: { ideal: 720 },
            aspectRatio: { ideal: 1 },
          },
        });

        if (!active) {
          stopMediaStream(stream);
          return;
        }

        setActiveStream(stream);
        activeStreamRef.current = stream;
        setStatus("ready");
        setErrorMessage(null);
      } catch (error) {
        if (!active) {
          return;
        }

        setErrorMessage(
          error instanceof Error && error.message.trim().length > 0
            ? "Не удалось открыть камеру. Можно попробовать системную запись."
            : "Камера недоступна. Можно попробовать системную запись.",
        );
        setStatus("fallback");
      }
    }

    void prepareRecorder();

    return () => {
      active = false;
      recorderRef.current = null;
      stopMediaStream(activeStreamRef.current);
      activeStreamRef.current = null;
    };
  }, []);

  useEffect(() => {
    activeStreamRef.current = activeStream;
  }, [activeStream]);

  useEffect(() => {
    const previewElement = previewRef.current;

    if (!previewElement) {
      return;
    }

    previewElement.srcObject = activeStream;

    if (activeStream) {
      void previewElement.play().catch(() => undefined);
      return;
    }

    previewElement.srcObject = null;
  }, [activeStream]);

  useEffect(() => {
    if (status !== "recording") {
      return;
    }

    const tick = window.setInterval(() => {
      const startedAt = recordingStartedAtRef.current;

      if (!startedAt) {
        return;
      }

      setRecordingDurationMs(getCurrentTimestampMs() - startedAt);
    }, 120);

    return () => {
      window.clearInterval(tick);
    };
  }, [status]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        void handleClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleClose]);

  async function startRecording() {
    if (disabled || status !== "ready" || !activeStream) {
      return;
    }

    const mimeType = resolveRecorderMimeType();

    try {
      const recorder = mimeType
        ? new MediaRecorder(activeStream, { mimeType })
        : new MediaRecorder(activeStream);

      chosenMimeTypeRef.current = mimeType ?? recorder.mimeType ?? null;
      chunksRef.current = [];
      discardRecordingRef.current = false;
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      recorder.onerror = () => {
        setErrorMessage("Не удалось записать видео. Попробуйте ещё раз.");
        resetRecordingSession();
        setStatus("ready");
      };
      recorder.onstop = () => {
        void finalizeRecording();
      };
      recordingStartedAtRef.current = getCurrentTimestampMs();
      setRecordingDurationMs(0);
      setStatus("recording");
      recorder.start(250);
    } catch {
      setErrorMessage("Запись видео недоступна на этом устройстве.");
      setStatus("fallback");
    }
  }

  function stopRecording() {
    const recorder = recorderRef.current;

    if (!recorder || recorder.state === "inactive") {
      return;
    }

    setStatus("processing");
    recorder.stop();
  }

  async function finalizeRecording() {
    const recorder = recorderRef.current;
    const shouldDiscard = discardRecordingRef.current;
    const blob = new Blob(chunksRef.current, {
      type: recorder?.mimeType || chosenMimeTypeRef.current || "video/webm",
    });

    cleanupRecorder();

    if (shouldDiscard) {
      discardRecordingRef.current = false;
      onClose();
      return;
    }

    if (blob.size === 0) {
      setErrorMessage("Видео не записалось. Попробуйте ещё раз.");
      setStatus("fallback");
      return;
    }

    setStatus("processing");

    const file = new File(
      [blob],
      buildVideoNoteFileName({
        mimeType: blob.type,
      }),
      {
        type: blob.type || "video/webm",
        lastModified: getCurrentTimestampMs(),
      },
    );

    await onSend(file);
    onClose();
  }

  async function handleFallbackFileSelect(fileList: FileList | null) {
    const sourceFile = fileList?.[0];

    if (!sourceFile) {
      return;
    }

    setStatus("processing");

    const file = new File(
      [sourceFile],
      buildVideoNoteFileName({
        mimeType: sourceFile.type,
        originalName: sourceFile.name,
      }),
      {
        type: sourceFile.type,
        lastModified: getCurrentTimestampMs(),
      },
    );

    await onSend(file);
    onClose();
  }

  const statusLabel =
    status === "preparing"
      ? "Подключаем камеру"
      : status === "recording"
        ? `Идёт запись ${formatVideoNoteDuration(recordingDurationMs)}`
        : status === "processing"
          ? "Подготавливаем видео"
          : status === "fallback"
            ? "Системная запись"
            : "Видео-кружок";

  return (
    <div className="dm-video-note-panel">
      <input
        ref={captureInputRef}
        type="file"
        accept="video/mp4,video/webm,video/*"
        capture="user"
        className="hidden"
        onChange={(event) => {
          void handleFallbackFileSelect(event.currentTarget.files);
          event.currentTarget.value = "";
        }}
      />

      <div className="dm-video-note-shell">
        <div className="dm-video-note-stage">
          <div className="dm-video-note-preview-wrap">
            {status === "fallback" ? (
              <div className="dm-video-note-fallback">
                <Camera size={26} strokeWidth={1.6} />
              </div>
            ) : (
              <video
                ref={previewRef}
                muted
                playsInline
                autoPlay
                className="dm-video-note-preview"
              />
            )}

            <div className="dm-video-note-badge">
              {status === "recording" ? (
                <span className="dm-video-note-live-dot" aria-hidden="true" />
              ) : null}
              <span>{statusLabel}</span>
            </div>
          </div>

          <div className="dm-video-note-copy">
            <p className="dm-video-note-title">Кружок с камеры</p>
            <p className="dm-video-note-description">
              {status === "fallback"
                ? "Откроем системную камеру и отправим видео как круглый видеомесседж."
                : "Компактная запись с фронтальной камеры. После остановки она сразу отправится в чат."}
            </p>
            {errorMessage ? (
              <p className="dm-video-note-error">{errorMessage}</p>
            ) : null}
          </div>
        </div>

        <div className="dm-video-note-actions">
          <button
            type="button"
            onClick={() => void handleClose()}
            disabled={status === "processing"}
            className="dm-video-note-action"
          >
            <X size={16} strokeWidth={1.6} />
            <span>Отмена</span>
          </button>

          {status === "fallback" ? (
            <button
              type="button"
              onClick={() => captureInputRef.current?.click()}
              disabled={disabled}
              className="dm-video-note-action dm-video-note-action-primary"
            >
              <Camera size={16} strokeWidth={1.6} />
              <span>Открыть камеру</span>
            </button>
          ) : status === "recording" ? (
            <button
              type="button"
              onClick={stopRecording}
              disabled={disabled}
              className="dm-video-note-action dm-video-note-action-danger"
            >
              <Square size={15} strokeWidth={1.8} />
              <span>Остановить</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void startRecording()}
              disabled={disabled || status === "preparing" || status === "processing"}
              className={cn(
                "dm-video-note-action dm-video-note-action-primary",
                status === "processing" && "opacity-70",
              )}
            >
              {status === "processing" ? (
                <LoaderCircle size={16} strokeWidth={1.7} className="animate-spin" />
              ) : (
                <Circle size={15} strokeWidth={1.9} />
              )}
              <span>
                {status === "processing"
                  ? "Отправляем"
                  : status === "preparing"
                    ? "Подключаем"
                    : "Записать"}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function supportsLiveVideoNotes() {
  return (
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

function resolveRecorderMimeType() {
  if (typeof MediaRecorder === "undefined") {
    return null;
  }

  return (
    preferredRecorderMimeTypes.find((value) =>
      typeof MediaRecorder.isTypeSupported === "function"
        ? MediaRecorder.isTypeSupported(value)
        : false,
    ) ?? null
  );
}

function stopMediaStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => {
    track.stop();
  });
}

function formatVideoNoteDuration(durationMs: number) {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function getCurrentTimestampMs() {
  if (
    typeof window !== "undefined" &&
    typeof window.performance !== "undefined"
  ) {
    return Math.round(
      window.performance.timeOrigin + window.performance.now(),
    );
  }

  return 0;
}
