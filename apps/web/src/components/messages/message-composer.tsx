"use client";

import type {
  CustomEmojiAsset,
  DirectMessageReplyPreview,
  GifAsset,
  MediaPickerCatalog,
  StickerAsset,
  StickerCatalog,
} from "@lobby/shared";
import {
  FileText,
  ImagePlus,
  Loader2,
  Mic,
  Paperclip,
  Reply,
  SendHorizontal,
  Smile,
  Square,
  Video,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ClipboardEvent as ReactClipboardEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { buildCustomEmojiToken } from "@/lib/stickers";
import { Button } from "@/components/ui/button";
import {
  buildVideoNoteFileName,
  buildVoiceNoteFileName,
} from "@/lib/direct-message-video-notes";
import { cn } from "@/lib/utils";
import { EmojiStickerPicker, type PickerTab } from "./emoji-sticker-picker";

export type ComposerSendPayload =
  | { type: "TEXT"; content: string }
  | { type: "STICKER"; stickerId: string; sticker: StickerAsset }
  | { type: "GIF"; gifId: string; gif: GifAsset };

export type ComposerFileUploadMode = "media" | "document";

interface MessageComposerProps {
  disabled: boolean;
  canManageLibrary: boolean;
  pickerCatalog: MediaPickerCatalog | null;
  isPickerCatalogLoading: boolean;
  pickerCatalogError: string | null;
  isUploadingFiles: boolean;
  onRefreshPickerCatalog: () => Promise<MediaPickerCatalog | null>;
  onStickerCatalogChange: (catalog: StickerCatalog) => void;
  onUploadFiles: (files: File[], mode: ComposerFileUploadMode) => Promise<void>;
  onSend: (payload: ComposerSendPayload) => Promise<void>;
  onTypingChange?: (isTyping: boolean) => void;
  replyToMessage: DirectMessageReplyPreview | null;
  onCancelReply: () => void;
}

const BASE_HEIGHT = 38;
const MAX_HEIGHT = 112;
const RECENT_EMOJIS_KEY = "lobby:dm:recent-emojis";
const RECENT_GIFS_KEY = "lobby:dm:recent-gifs";
const MAX_RECENT_EMOJIS = 28;
const MAX_RECENT_STICKERS = 24;
const MAX_RECENT_GIFS = 20;
const iconProps = { size: 19, strokeWidth: 1.55 } as const;
const MOBILE_VIEWPORT_QUERY = "(max-width: 767px)";
const VIDEO_NOTE_MAX_DURATION_MS = 45_000;
const VIDEO_NOTE_TIMESLICE_MS = 900;
const VIDEO_NOTE_VIDEO_BITS_PER_SECOND = 1_450_000;
const VIDEO_NOTE_AUDIO_BITS_PER_SECOND = 96_000;
const VOICE_NOTE_MAX_DURATION_MS = 120_000;
const VOICE_NOTE_AUDIO_BITS_PER_SECOND = 96_000;

type RecorderMode = "voice" | "video";

function readRecentStrings(storageKey: string) {
  if (typeof window === "undefined") {
    return [] as string[];
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]");

    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function writeRecentStrings(storageKey: string, nextItems: string[]) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(storageKey, JSON.stringify(nextItems));
  }
}

function getSupportedVideoNoteMimeType() {
  if (typeof MediaRecorder === "undefined") {
    return "";
  }

  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4",
  ];

  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

function getSupportedVoiceNoteMimeType() {
  if (typeof MediaRecorder === "undefined") {
    return "";
  }

  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];

  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

function stopMediaStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

function moveStickerToRecent(
  catalog: StickerCatalog,
  sticker: StickerAsset,
): StickerCatalog {
  const packTitle =
    catalog.packs.find((pack) => pack.id === sticker.packId)?.title ??
    "Стикеры";
  const nextRecent = [
    {
      packId: sticker.packId,
      packTitle,
      usedAt: new Date().toISOString(),
      usageCount:
        (catalog.recent.find((item) => item.sticker.id === sticker.id)
          ?.usageCount ?? 0) + 1,
      sticker,
    },
    ...catalog.recent.filter((item) => item.sticker.id !== sticker.id),
  ].slice(0, MAX_RECENT_STICKERS);

  return {
    ...catalog,
    recent: nextRecent,
  };
}

function buildComposerReplyPreview(message: DirectMessageReplyPreview) {
  if (message.isDeleted) {
    return "Сообщение удалено";
  }

  const content = message.content?.trim();

  if (content) {
    return content;
  }

  if (message.type === "STICKER") {
    return message.sticker?.title ? `Стикер: ${message.sticker.title}` : "Стикер";
  }

  if (message.type === "GIF") {
    return message.gif?.title ? `GIF: ${message.gif.title}` : "GIF";
  }

  if (message.type === "MEDIA" && message.attachment) {
    return message.attachment.kind === "VIDEO" ? "Видео" : "Фото";
  }

  if (message.type === "FILE" && message.attachment) {
    return message.attachment.originalName || "Файл";
  }

  return "Сообщение";
}

function formatVideoNoteDuration(durationMs: number) {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function MessageComposer({
  disabled,
  canManageLibrary,
  pickerCatalog,
  isPickerCatalogLoading,
  pickerCatalogError,
  isUploadingFiles,
  onRefreshPickerCatalog,
  onStickerCatalogChange,
  onUploadFiles,
  onSend,
  onTypingChange,
  replyToMessage,
  onCancelReply,
}: MessageComposerProps) {
  const [content, setContent] = useState("");
  const [isSendingText, setIsSendingText] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<PickerTab>("emoji");
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [recorderMode, setRecorderMode] = useState<RecorderMode>("voice");
  const [videoNoteOpen, setVideoNoteOpen] = useState(false);
  const [videoNoteStatus, setVideoNoteStatus] = useState<
    "idle" | "requesting" | "recording" | "preview" | "sending" | "error"
  >("idle");
  const [videoNoteError, setVideoNoteError] = useState<string | null>(null);
  const [videoNotePreviewUrl, setVideoNotePreviewUrl] = useState<string | null>(
    null,
  );
  const [videoNoteDurationMs, setVideoNoteDurationMs] = useState(0);
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);
  const [recentGifIds, setRecentGifIds] = useState<string[]>([]);
  const [pendingStickerIds, setPendingStickerIds] = useState<string[]>([]);
  const [pendingGifIds, setPendingGifIds] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const documentInputRef = useRef<HTMLInputElement | null>(null);
  const contentRef = useRef("");
  const selectionRef = useRef({ start: 0, end: 0 });
  const typingStopTimerRef = useRef<number | null>(null);
  const videoNoteStreamRef = useRef<MediaStream | null>(null);
  const videoNoteRecorderRef = useRef<MediaRecorder | null>(null);
  const videoNoteChunksRef = useRef<BlobPart[]>([]);
  const videoNoteBlobRef = useRef<Blob | null>(null);
  const videoNoteStartedAtRef = useRef<number | null>(null);
  const videoNoteDurationTimerRef = useRef<number | null>(null);
  const videoNoteStopTimerRef = useRef<number | null>(null);
  const videoNotePreviewVideoRef = useRef<HTMLVideoElement | null>(null);
  const isTypingRef = useRef(false);

  const updateContent = useCallback((nextContent: string) => {
    contentRef.current = nextContent;
    setContent(nextContent);
  }, []);

  const stopTyping = useCallback(() => {
    if (typingStopTimerRef.current !== null) {
      window.clearTimeout(typingStopTimerRef.current);
      typingStopTimerRef.current = null;
    }

    if (!isTypingRef.current) {
      return;
    }

    isTypingRef.current = false;
    onTypingChange?.(false);
  }, [onTypingChange]);

  const clearVideoNoteTimers = useCallback(() => {
    if (videoNoteDurationTimerRef.current !== null) {
      window.clearInterval(videoNoteDurationTimerRef.current);
      videoNoteDurationTimerRef.current = null;
    }

    if (videoNoteStopTimerRef.current !== null) {
      window.clearTimeout(videoNoteStopTimerRef.current);
      videoNoteStopTimerRef.current = null;
    }
  }, []);

  const resetVideoNoteDraft = useCallback(() => {
    clearVideoNoteTimers();
    videoNoteRecorderRef.current = null;
    videoNoteChunksRef.current = [];
    videoNoteBlobRef.current = null;
    videoNoteStartedAtRef.current = null;
    stopMediaStream(videoNoteStreamRef.current);
    videoNoteStreamRef.current = null;
    setVideoNoteDurationMs(0);
    setVideoNotePreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }

      return null;
    });
  }, [clearVideoNoteTimers]);

  const closeVideoNoteRecorder = useCallback(() => {
    const recorder = videoNoteRecorderRef.current;

    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      recorder.stop();
    }

    resetVideoNoteDraft();
    setVideoNoteOpen(false);
    setVideoNoteStatus("idle");
    setVideoNoteError(null);
  }, [resetVideoNoteDraft]);

  const finishVideoNoteRecording = useCallback(() => {
    const recorder = videoNoteRecorderRef.current;

    if (!recorder || recorder.state === "inactive") {
      return;
    }

    recorder.stop();
  }, []);

  const startVideoNoteRecording = useCallback(async () => {
    if (disabled || isUploadingFiles) {
      return;
    }

    resetVideoNoteDraft();
    setVideoNoteOpen(true);
    setVideoNoteStatus("requesting");
    setVideoNoteError(null);

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setVideoNoteStatus("error");
      setVideoNoteError("Р‘СЂР°СѓР·РµСЂ РЅРµ РїРѕРґРґРµСЂР¶РёРІР°РµС‚ Р·Р°РїРёСЃСЊ РІРёРґРµРѕ.");
      return;
    }

    try {
      const isVideoMode = recorderMode === "video";
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: isVideoMode
          ? {
              facingMode: "user",
              width: { ideal: 720, max: 960 },
              height: { ideal: 720, max: 960 },
              frameRate: { ideal: 30, max: 30 },
            }
          : false,
      });
      const mimeType = isVideoMode
        ? getSupportedVideoNoteMimeType()
        : getSupportedVoiceNoteMimeType();
      const recorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        ...(isVideoMode
          ? { videoBitsPerSecond: VIDEO_NOTE_VIDEO_BITS_PER_SECOND }
          : {}),
        audioBitsPerSecond: isVideoMode
          ? VIDEO_NOTE_AUDIO_BITS_PER_SECOND
          : VOICE_NOTE_AUDIO_BITS_PER_SECOND,
      });

      videoNoteStreamRef.current = stream;
      videoNoteRecorderRef.current = recorder;
      videoNoteChunksRef.current = [];
      videoNoteStartedAtRef.current = performance.now();

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          videoNoteChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        setVideoNoteStatus("error");
        setVideoNoteError("РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РїРёСЃР°С‚СЊ РєСЂСѓР¶РѕС‡РµРє.");
      };

      recorder.onstop = () => {
        clearVideoNoteTimers();
        stopMediaStream(stream);
        videoNoteStreamRef.current = null;
        const blob = new Blob(videoNoteChunksRef.current, {
          type:
            recorder.mimeType ||
            mimeType ||
            (isVideoMode ? "video/webm" : "audio/webm"),
        });

        if (blob.size === 0) {
          setVideoNoteStatus("error");
          setVideoNoteError("Р’РёРґРµРѕ РїРѕР»СѓС‡РёР»РѕСЃСЊ РїСѓСЃС‚С‹Рј.");
          return;
        }

        videoNoteBlobRef.current = blob;
        const previewUrl = URL.createObjectURL(blob);
        setVideoNotePreviewUrl((current) => {
          if (current) {
            URL.revokeObjectURL(current);
          }

          return previewUrl;
        });
        setVideoNoteStatus("preview");
      };

      recorder.start(VIDEO_NOTE_TIMESLICE_MS);
      setVideoNoteStatus("recording");
      setVideoNoteDurationMs(0);
      videoNoteDurationTimerRef.current = window.setInterval(() => {
        const startedAt = videoNoteStartedAtRef.current;
        const maxDuration = isVideoMode
          ? VIDEO_NOTE_MAX_DURATION_MS
          : VOICE_NOTE_MAX_DURATION_MS;
        setVideoNoteDurationMs(
          startedAt ? Math.min(performance.now() - startedAt, maxDuration) : 0,
        );
      }, 180);
      videoNoteStopTimerRef.current = window.setTimeout(
        finishVideoNoteRecording,
        isVideoMode ? VIDEO_NOTE_MAX_DURATION_MS : VOICE_NOTE_MAX_DURATION_MS,
      );

      const previewVideo = videoNotePreviewVideoRef.current;
      if (previewVideo && isVideoMode) {
        previewVideo.srcObject = stream;
        previewVideo.muted = true;
        previewVideo.playsInline = true;
        void previewVideo.play().catch(() => undefined);
      }
    } catch (error) {
      resetVideoNoteDraft();
      setVideoNoteStatus("error");
      setVideoNoteError(
        error instanceof DOMException && error.name === "NotAllowedError"
          ? "РќСѓР¶РµРЅ РґРѕСЃС‚СѓРї Рє РєР°РјРµСЂРµ Рё РјРёРєСЂРѕС„РѕРЅСѓ."
          : "РќРµ СѓРґР°Р»РѕСЃСЊ РѕС‚РєСЂС‹С‚СЊ РєР°РјРµСЂСѓ.",
      );
    }
  }, [
    clearVideoNoteTimers,
    disabled,
    finishVideoNoteRecording,
    isUploadingFiles,
    resetVideoNoteDraft,
    recorderMode,
  ]);

  const sendVideoNote = useCallback(async () => {
    const blob = videoNoteBlobRef.current;

    if (!blob || disabled || isUploadingFiles || videoNoteStatus === "sending") {
      return;
    }

    setVideoNoteStatus("sending");
    setVideoNoteError(null);

    try {
      const file = new File(
        [blob],
        recorderMode === "video"
          ? buildVideoNoteFileName({
              mimeType: blob.type,
            })
          : buildVoiceNoteFileName({
              mimeType: blob.type,
            }),
        {
          type: blob.type || (recorderMode === "video" ? "video/webm" : "audio/webm"),
          lastModified: Date.now(),
        },
      );

      await onUploadFiles([file], recorderMode === "video" ? "media" : "document");
      closeVideoNoteRecorder();
      textareaRef.current?.focus();
    } catch (error) {
      setVideoNoteStatus("preview");
      setVideoNoteError(
        error instanceof Error ? error.message : "РќРµ СѓРґР°Р»РѕСЃСЊ РѕС‚РїСЂР°РІРёС‚СЊ РєСЂСѓР¶РѕС‡РµРє.",
      );
    }
  }, [
    closeVideoNoteRecorder,
    disabled,
    isUploadingFiles,
    onUploadFiles,
    recorderMode,
    videoNoteStatus,
  ]);

  const notifyTypingFromDraft = useCallback(
    (nextContent: string) => {
      if (!onTypingChange || disabled || isUploadingFiles) {
        return;
      }

      if (nextContent.trim().length === 0) {
        stopTyping();
        return;
      }

      if (!isTypingRef.current) {
        isTypingRef.current = true;
        onTypingChange(true);
      }

      if (typingStopTimerRef.current !== null) {
        window.clearTimeout(typingStopTimerRef.current);
      }

      typingStopTimerRef.current = window.setTimeout(stopTyping, 2200);
    },
    [disabled, isUploadingFiles, onTypingChange, stopTyping],
  );

  const syncTextareaHeight = useCallback(() => {
    const element = textareaRef.current;

    if (!element) {
      return;
    }

    element.style.height = `${BASE_HEIGHT}px`;
    const nextHeight = Math.min(element.scrollHeight, MAX_HEIGHT);
    element.style.height = `${nextHeight}px`;
    element.style.overflowY =
      element.scrollHeight > MAX_HEIGHT ? "auto" : "hidden";
  }, []);

  useEffect(() => {
    if (!replyToMessage || disabled || isUploadingFiles) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      textareaRef.current?.focus({ preventScroll: true });
      syncTextareaHeight();
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [disabled, isUploadingFiles, replyToMessage, syncTextareaHeight]);

  useEffect(() => {
    setRecentEmojis(readRecentStrings(RECENT_EMOJIS_KEY));
    setRecentGifIds(readRecentStrings(RECENT_GIFS_KEY));
  }, []);

  useEffect(() => stopTyping, [stopTyping]);

  useEffect(() => closeVideoNoteRecorder, [closeVideoNoteRecorder]);

  useEffect(() => {
    if (!videoNoteOpen || videoNoteStatus !== "recording") {
      return;
    }

    const video = videoNotePreviewVideoRef.current;

    if (!video || !videoNoteStreamRef.current) {
      return;
    }

    video.srcObject = videoNoteStreamRef.current;
    video.muted = true;
    video.playsInline = true;
    void video.play().catch(() => undefined);
  }, [videoNoteOpen, videoNoteStatus]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia(MOBILE_VIEWPORT_QUERY);
    const updateViewport = () => setIsMobileViewport(mediaQuery.matches);

    updateViewport();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", updateViewport);
    } else {
      mediaQuery.addListener(updateViewport);
    }

    return () => {
      if (typeof mediaQuery.removeEventListener === "function") {
        mediaQuery.removeEventListener("change", updateViewport);
      } else {
        mediaQuery.removeListener(updateViewport);
      }
    };
  }, []);

  useLayoutEffect(() => {
    syncTextareaHeight();
  }, [content, syncTextareaHeight]);

  useEffect(() => {
    if (!pickerOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as HTMLElement | null;

      if (target?.closest("[data-composer-picker-root]")) {
        return;
      }

      setPickerOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPickerOpen(false);

        if (!isMobileViewport) {
          textareaRef.current?.focus();
        }
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMobileViewport, pickerOpen]);

  useEffect(() => {
    if (!attachMenuOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as HTMLElement | null;

      if (target?.closest("[data-composer-attach-root]")) {
        return;
      }

      setAttachMenuOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setAttachMenuOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [attachMenuOpen]);

  const refreshCatalogIfNeeded = useCallback(async () => {
    if (pickerCatalog || isPickerCatalogLoading) {
      return pickerCatalog;
    }

    return await onRefreshPickerCatalog();
  }, [isPickerCatalogLoading, onRefreshPickerCatalog, pickerCatalog]);

  async function togglePickerTab(nextTab: PickerTab) {
    const shouldClose = pickerOpen && activeTab === nextTab;

    setAttachMenuOpen(false);
    setActiveTab(nextTab);
    setPickerOpen(!shouldClose);

    if (isMobileViewport) {
      textareaRef.current?.blur();
    }

    if (!shouldClose) {
      await refreshCatalogIfNeeded();
    }
  }

  function syncSelection() {
    const element = textareaRef.current;

    if (!element) {
      return;
    }

    selectionRef.current = {
      start: element.selectionStart ?? content.length,
      end: element.selectionEnd ?? content.length,
    };
  }

  function focusTextarea(position?: number) {
    const element = textareaRef.current;

    if (!element) {
      return;
    }

    element.focus();

    if (typeof position === "number") {
      element.setSelectionRange(position, position);
      selectionRef.current = {
        start: position,
        end: position,
      };
    }
  }

  function pushRecentEmoji(emoji: string) {
    setRecentEmojis((current) => {
      const nextItems = [
        emoji,
        ...current.filter((item) => item !== emoji),
      ].slice(0, MAX_RECENT_EMOJIS);
      writeRecentStrings(RECENT_EMOJIS_KEY, nextItems);
      return nextItems;
    });
  }

  function pushRecentGif(gifId: string) {
    setRecentGifIds((current) => {
      const nextItems = [
        gifId,
        ...current.filter((item) => item !== gifId),
      ].slice(0, MAX_RECENT_GIFS);
      writeRecentStrings(RECENT_GIFS_KEY, nextItems);
      return nextItems;
    });
  }

  function insertTextToken(token: string, recentEmoji?: string) {
    const element = textareaRef.current;
    const { start, end } = selectionRef.current;
    const before = content.slice(0, start);
    const after = content.slice(end);
    const nextContent = `${before}${token}${after}`;
    const nextPosition = start + token.length;

    updateContent(nextContent);

    if (recentEmoji) {
      pushRecentEmoji(recentEmoji);
    }

    requestAnimationFrame(() => {
      if (!element) {
        return;
      }

      selectionRef.current = {
        start: nextPosition,
        end: nextPosition,
      };

      if (isMobileViewport && pickerOpen) {
        return;
      }

      element.focus();
      element.setSelectionRange(nextPosition, nextPosition);
    });
  }

  function insertEmoji(emoji: string) {
    insertTextToken(emoji, emoji);
  }

  function insertCustomEmoji(emoji: CustomEmojiAsset) {
    insertTextToken(buildCustomEmojiToken(emoji.alias));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSendingText) {
      return;
    }

    const submittedContent = contentRef.current;
    const trimmed = submittedContent.trim();

    if (!trimmed) {
      return;
    }

    setIsSendingText(true);
    stopTyping();
    updateContent("");
    requestAnimationFrame(() => focusTextarea(0));

    try {
      await onSend({
        type: "TEXT",
        content: trimmed,
      });
    } catch {
      if (contentRef.current.length === 0) {
        updateContent(submittedContent);
      }
    } finally {
      setIsSendingText(false);
    }
  }

  async function handleStickerSelect(sticker: StickerAsset) {
    if (disabled || pendingStickerIds.includes(sticker.id)) {
      return;
    }

    setPendingStickerIds((current) => [...current, sticker.id]);

    try {
      await onSend({
        type: "STICKER",
        stickerId: sticker.id,
        sticker,
      });

      if (pickerCatalog) {
        onStickerCatalogChange(
          moveStickerToRecent(pickerCatalog.stickers, sticker),
        );
      }

      if (!isMobileViewport || !pickerOpen) {
        textareaRef.current?.focus();
      }
    } finally {
      setPendingStickerIds((current) =>
        current.filter((item) => item !== sticker.id),
      );
    }
  }

  async function handleGifSelect(gif: GifAsset) {
    if (disabled || pendingGifIds.includes(gif.id)) {
      return;
    }

    setPendingGifIds((current) => [...current, gif.id]);

    try {
      await onSend({
        type: "GIF",
        gifId: gif.id,
        gif,
      });
      pushRecentGif(gif.id);

      if (!isMobileViewport || !pickerOpen) {
        textareaRef.current?.focus();
      }
    } finally {
      setPendingGifIds((current) => current.filter((item) => item !== gif.id));
    }
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    syncSelection();

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSubmit(event as unknown as FormEvent<HTMLFormElement>);
    }
  }

  async function handleFilesSelected(
    fileList: FileList | null,
    mode: ComposerFileUploadMode,
  ) {
    if (disabled || !fileList || fileList.length === 0) {
      return;
    }

    await onUploadFiles(Array.from(fileList), mode);
    textareaRef.current?.focus();
  }

  function handlePaste(event: ReactClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(event.clipboardData.files ?? []);

    if (files.length === 0) {
      return;
    }

    event.preventDefault();
    void onUploadFiles(
      files,
      files.every(
        (file) =>
          file.type.startsWith("image/") || file.type.startsWith("video/"),
      )
        ? "media"
        : "document",
    );
  }

  const pickerMarkup = (
    <EmojiStickerPicker
      activeTab={activeTab}
      recentEmojis={recentEmojis}
      recentGifIds={recentGifIds}
      catalog={pickerCatalog}
      isCatalogLoading={isPickerCatalogLoading}
      catalogError={pickerCatalogError}
      pendingStickerIds={pendingStickerIds}
      pendingGifIds={pendingGifIds}
      canManageLibrary={canManageLibrary}
      onTabChange={(tab) => {
        setActiveTab(tab);
        void refreshCatalogIfNeeded();
      }}
      onEmojiSelect={insertEmoji}
      onCustomEmojiSelect={insertCustomEmoji}
      onStickerSelect={(sticker) => void handleStickerSelect(sticker)}
      onGifSelect={(gif) => void handleGifSelect(gif)}
      onRetryCatalog={() => void onRefreshPickerCatalog()}
      onOpenManager={() => {
        if (!canManageLibrary) {
          return;
        }

        if (typeof window !== "undefined") {
          window.location.assign("/app/admin/sticker-packs");
        }
      }}
      className={isMobileViewport ? "dm-picker-shell-mobile" : undefined}
    />
  );
  const hasTextDraft = content.trim().length > 0;
  const recorderMaxDurationMs =
    recorderMode === "video" ? VIDEO_NOTE_MAX_DURATION_MS : VOICE_NOTE_MAX_DURATION_MS;
  const videoNoteProgress = Math.min(
    1,
    videoNoteDurationMs / recorderMaxDurationMs,
  );
  const videoNoteDurationLabel = formatVideoNoteDuration(videoNoteDurationMs);
  const videoNoteCanRecord = !disabled && !isUploadingFiles;
  const isRecorderActive = videoNoteOpen && videoNoteStatus !== "idle";
  const videoNoteCircleLabel =
    videoNoteStatus === "recording"
      ? "РћСЃС‚Р°РЅРѕРІРёС‚СЊ Р·Р°РїРёСЃСЊ"
    : videoNoteStatus === "preview"
        ? recorderMode === "video"
          ? "РћС‚РїСЂР°РІРёС‚СЊ РєСЂСѓР¶РѕС‡РµРє"
          : "РћС‚РїСЂР°РІРёС‚СЊ РіРѕР»РѕСЃРѕРІРѕРµ"
      : "РќР°С‡Р°С‚СЊ Р·Р°РїРёСЃСЊ";
  const voiceNoteRecorderMarkup =
    recorderMode === "voice" && videoNoteOpen ? (
      <div
        className={cn(
          "dm-voice-recorder-strip",
          videoNoteStatus === "recording" && "dm-voice-recorder-strip-recording",
          videoNoteStatus === "preview" && "dm-voice-recorder-strip-ready",
          videoNoteStatus === "error" && "dm-voice-recorder-strip-error",
        )}
      >
        <div className="dm-voice-recorder-status" aria-hidden="true">
          {videoNoteStatus === "requesting" || videoNoteStatus === "sending" ? (
            <Loader2 size={16} strokeWidth={1.7} className="animate-spin" />
          ) : (
            <Mic size={16} strokeWidth={1.7} />
          )}
        </div>

        <div className="dm-voice-recorder-body">
          <div className="dm-voice-recorder-meta">
            <span>
              {videoNoteStatus === "recording"
                ? "Запись"
                : videoNoteStatus === "preview"
                  ? "Голосовое готово"
                  : videoNoteStatus === "sending"
                    ? "Отправляем"
                    : videoNoteStatus === "error"
                      ? "Ошибка записи"
                      : "Голосовое"}
            </span>
            <span>{videoNoteDurationLabel}</span>
          </div>

          {videoNoteStatus === "preview" && videoNotePreviewUrl ? (
            <audio
              src={videoNotePreviewUrl}
              controls
              preload="metadata"
              className="dm-voice-recorder-audio"
            />
          ) : (
            <div
              className="dm-voice-recorder-wave"
              style={{
                "--dm-video-note-progress": videoNoteProgress,
              } as CSSProperties}
            >
              {Array.from({ length: 30 }).map((_, index) => (
                <span
                  key={index}
                  style={{
                    animationDelay: `${index * -38}ms`,
                    height: `${7 + ((index * 17) % 15)}px`,
                  }}
                />
              ))}
            </div>
          )}

          {videoNoteError ? (
            <p className="dm-voice-recorder-error">{videoNoteError}</p>
          ) : null}
        </div>

        <div className="dm-voice-recorder-actions">
          <button
            type="button"
            className="dm-voice-recorder-action"
            onClick={closeVideoNoteRecorder}
            aria-label="Отменить голосовое"
            title="Отменить"
          >
            <X size={16} strokeWidth={1.7} />
          </button>

          {videoNoteStatus === "recording" ? (
            <button
              type="button"
              className="dm-voice-recorder-action dm-voice-recorder-action-primary"
              onClick={finishVideoNoteRecording}
              aria-label="Остановить запись"
              title="Остановить"
            >
              <Square size={15} strokeWidth={1.8} fill="currentColor" />
            </button>
          ) : videoNoteStatus === "preview" ? (
            <button
              type="button"
              className="dm-voice-recorder-action dm-voice-recorder-action-primary"
              onClick={() => void sendVideoNote()}
              aria-label="Отправить голосовое"
              title="Отправить"
            >
              <SendHorizontal size={17} strokeWidth={1.7} />
            </button>
          ) : videoNoteStatus === "error" ? (
            <button
              type="button"
              className="dm-voice-recorder-action dm-voice-recorder-action-primary"
              onClick={() => void startVideoNoteRecording()}
              aria-label="Записать заново"
              title="Записать заново"
            >
              <Mic size={16} strokeWidth={1.7} />
            </button>
          ) : null}
        </div>
      </div>
    ) : null;
  const videoNoteModalMarkup = videoNoteOpen && recorderMode === "video" ? (
    <div className="dm-video-note-modal" role="dialog" aria-modal="true">
      <button
        type="button"
        className="dm-video-note-close"
        onClick={closeVideoNoteRecorder}
        aria-label="Р—Р°РєСЂС‹С‚СЊ Р·Р°РїРёСЃСЊ РєСЂСѓР¶РѕС‡РєР°"
      >
        <X size={18} strokeWidth={1.7} />
      </button>

      <button
        type="button"
        className={cn(
          "dm-video-note-record-surface",
          videoNoteStatus === "recording" && "dm-video-note-recording",
          videoNoteStatus === "preview" && "dm-video-note-ready",
          videoNoteStatus === "sending" && "dm-video-note-sending",
          videoNoteStatus === "error" && "dm-video-note-error",
        )}
        style={{
          "--dm-video-note-progress": videoNoteProgress,
        } as CSSProperties}
        onClick={() => {
          if (videoNoteStatus === "recording") {
            finishVideoNoteRecording();
            return;
          }

          if (videoNoteStatus === "preview") {
            void sendVideoNote();
            return;
          }

          if (videoNoteStatus === "error") {
            void startVideoNoteRecording();
          }
        }}
        disabled={videoNoteStatus === "requesting" || videoNoteStatus === "sending"}
        aria-label={videoNoteCircleLabel}
      >
        {videoNoteStatus === "recording" ? (
          <video
            ref={videoNotePreviewVideoRef}
            className="dm-video-note-record-media"
            autoPlay
            muted
            playsInline
          />
        ) : videoNotePreviewUrl ? (
          <video
            className="dm-video-note-record-media"
            src={videoNotePreviewUrl}
            autoPlay
            muted
            loop
            playsInline
          />
        ) : null}

        <span className="dm-video-note-record-vignette" aria-hidden="true" />
        <span className="dm-video-note-record-center">
          {videoNoteStatus === "requesting" || videoNoteStatus === "sending" ? (
            <Loader2 size={28} strokeWidth={1.7} className="animate-spin" />
          ) : videoNoteStatus === "recording" ? (
            <Square size={26} strokeWidth={1.8} fill="currentColor" />
          ) : videoNoteStatus === "preview" ? (
            <SendHorizontal size={30} strokeWidth={1.7} />
          ) : (
            <Video size={30} strokeWidth={1.7} />
          )}
        </span>

        <span className="dm-video-note-record-meta">
          {videoNoteStatus === "error"
            ? (videoNoteError ?? "РћС€РёР±РєР°")
            : videoNoteDurationLabel}
        </span>
      </button>
    </div>
  ) : null;

  return (
    <div className="dm-composer-stack">
      <form className="dm-composer-shell" onSubmit={handleSubmit}>
        <input
          ref={mediaInputRef}
          type="file"
          accept="image/*,video/mp4,video/webm"
          multiple
          className="hidden"
          onChange={(event) => {
            void handleFilesSelected(event.currentTarget.files, "media");
            event.currentTarget.value = "";
          }}
        />
        <input
          ref={documentInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => {
            void handleFilesSelected(event.currentTarget.files, "document");
            event.currentTarget.value = "";
          }}
        />

        {replyToMessage ? (
          <div className="dm-reply-strip">
            <div className="dm-reply-strip-line" aria-hidden="true" />
            <Reply
              size={15}
              strokeWidth={1.6}
              className="shrink-0 text-[var(--accent-strong)]"
            />
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate text-[11px] font-medium text-[var(--text-soft)]">
                Ответ {replyToMessage.author.profile.displayName}
              </p>
              <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
                {buildComposerReplyPreview(replyToMessage)}
              </p>
            </div>
            <button
              type="button"
              className="dm-action-button h-7 w-7 shrink-0"
              onClick={onCancelReply}
              aria-label="Отменить ответ"
              title="Отменить ответ"
              style={{ height: 28, width: 28 }}
            >
              <X size={13} strokeWidth={1.6} />
            </button>
          </div>
        ) : null}

        <div className="dm-recorder-mode-toggle" aria-label="Р РµР¶РёРј Р·Р°РїРёСЃРё">
          {[
            { value: "voice" as const, label: "Голос", icon: Mic },
            { value: "video" as const, label: "Кружок", icon: Video },
          ].map((item) => {
            const Icon = item.icon;
            const active = recorderMode === item.value;

            return (
              <button
                key={item.value}
                type="button"
                disabled={isRecorderActive}
                onClick={() => setRecorderMode(item.value)}
                className={cn("dm-recorder-mode-button", active && "dm-recorder-mode-button-active")}
                aria-pressed={active}
                title={item.label}
              >
                <Icon size={14} strokeWidth={1.6} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {voiceNoteRecorderMarkup}

        <div className="dm-composer-main">
          <div
            className="dm-composer-cluster relative"
            data-composer-attach-root="true"
          >
            {attachMenuOpen ? (
              <div className="absolute bottom-full left-0 z-50 mb-3 w-52 rounded-[18px] border border-white/8 bg-black p-2 shadow-[0_18px_40px_rgba(0,0,0,0.42)]">
                <button
                  type="button"
                  onClick={() => {
                    setAttachMenuOpen(false);
                    mediaInputRef.current?.click();
                  }}
                  className="flex w-full items-center gap-2 rounded-[12px] px-3 py-2 text-left text-sm text-white transition-colors hover:bg-white/[0.05]"
                >
                  <ImagePlus {...iconProps} />
                  Фото или видео
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAttachMenuOpen(false);
                    documentInputRef.current?.click();
                  }}
                  className="mt-1 flex w-full items-center gap-2 rounded-[12px] px-3 py-2 text-left text-sm text-white transition-colors hover:bg-white/[0.05]"
                >
                  <FileText {...iconProps} />
                  Документ
                </button>
              </div>
            ) : null}

            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={disabled || isUploadingFiles}
              onClick={() => {
                setAttachMenuOpen((current) => !current);
                setPickerOpen(false);
              }}
              className="dm-composer-cluster-button"
              aria-label="Прикрепить файл"
            >
              <Paperclip {...iconProps} />
            </Button>

          </div>

          <div className="dm-composer-input-shell">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(event) => {
                updateContent(event.target.value);
                notifyTypingFromDraft(event.target.value);
              }}
              onInput={syncTextareaHeight}
              onPaste={handlePaste}
              onClick={syncSelection}
              onKeyUp={syncSelection}
              onSelect={syncSelection}
              onKeyDown={handleKeyDown}
              placeholder={
                isUploadingFiles
                  ? "Загружаем файлы…"
                  : disabled
                    ? "В этом диалоге нельзя отправлять сообщения."
                    : "Сообщение..."
              }
              disabled={disabled || isUploadingFiles}
              rows={1}
              className={cn(
                "dm-composer-textarea relative block min-h-9 max-h-28 w-full resize-none whitespace-pre-wrap break-words border-none bg-transparent text-sm leading-[1.44] text-white caret-white outline-none transition-colors placeholder:text-[var(--text-muted)] disabled:cursor-not-allowed disabled:opacity-60 [overflow-wrap:anywhere]",
              )}
              style={{
                resize: "none",
                overflowWrap: "anywhere",
                wordBreak: "break-word",
                whiteSpace: "pre-wrap",
              }}
            />

            <div className="dm-composer-input-actions">
              <div className="relative" data-composer-picker-root="true">
                {!isMobileViewport && pickerOpen ? (
                  <div className="absolute bottom-full right-0 z-50 mb-3">
                    {pickerMarkup}
                  </div>
                ) : null}

                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={disabled || isUploadingFiles}
                  onClick={() => {
                    syncSelection();
                    void togglePickerTab("emoji");
                  }}
                  className={cn(
                    "dm-composer-input-icon",
                    pickerOpen &&
                      activeTab === "emoji" &&
                      "dm-composer-input-icon-active",
                  )}
                  aria-label="Открыть смайлики"
                >
                  <Smile {...iconProps} />
                </Button>
              </div>
            </div>
          </div>

          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={!videoNoteCanRecord}
            onClick={() => {
              setAttachMenuOpen(false);
              setPickerOpen(false);
              void startVideoNoteRecording();
            }}
            className="dm-composer-button dm-composer-video-note"
            aria-label={recorderMode === "video" ? "Записать кружочек" : "Записать голосовое"}
          >
            {recorderMode === "video" ? <Video {...iconProps} /> : <Mic {...iconProps} />}
          </Button>

          <Button
            type="submit"
            size="sm"
            disabled={disabled || isSendingText || isUploadingFiles || !hasTextDraft}
            className={cn(
              "dm-composer-button dm-composer-send",
              hasTextDraft && "dm-composer-send-ready",
            )}
            aria-label={
              isSendingText ? "Отправляем сообщение" : "Отправить сообщение"
            }
          >
            <SendHorizontal size={20} strokeWidth={1.6} />
          </Button>
        </div>
      </form>

      {isMobileViewport && pickerOpen ? (
        <div
          className="dm-picker-mobile-sheet"
          data-composer-picker-root="true"
        >
          <div className="dm-picker-mobile-grabber" aria-hidden="true" />
          {pickerMarkup}
        </div>
      ) : null}

      {videoNoteModalMarkup}
    </div>
  );
}
