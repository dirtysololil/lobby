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
  Mic,
  Paperclip,
  Reply,
  SendHorizontal,
  Smile,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type ClipboardEvent as ReactClipboardEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { buildCustomEmojiToken } from "@/lib/stickers";
import { Button } from "@/components/ui/button";
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
    } catch (error) {
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
            disabled={disabled || isUploadingFiles}
            onClick={() => {
              setAttachMenuOpen(false);
              setPickerOpen(false);
              textareaRef.current?.focus();
            }}
            className="dm-composer-button dm-composer-mic"
            aria-label="Голосовые сообщения"
          >
            <Mic {...iconProps} />
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
    </div>
  );
}
