"use client";

import type {
  CustomEmojiAsset,
  GifAsset,
  MediaPickerCatalog,
  StickerAsset,
  StickerCatalog,
} from "@lobby/shared";
import {
  FileText,
  ImagePlus,
  Paperclip,
  SendHorizontal,
  SmilePlus,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type ClipboardEvent as ReactClipboardEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { isEmojiCluster, splitGraphemes } from "@/lib/emoji/unicode";
import { buildCustomEmojiToken } from "@/lib/stickers";
import { customEmojiTokenPattern } from "@/lib/stickers";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EmojiStickerPicker, type PickerTab } from "./emoji-sticker-picker";
import { InlineCustomEmojiText } from "./inline-custom-emoji-text";

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
}

const BASE_HEIGHT = 38;
const MAX_HEIGHT = 112;
const RECENT_EMOJIS_KEY = "lobby:dm:recent-emojis";
const RECENT_GIFS_KEY = "lobby:dm:recent-gifs";
const MAX_RECENT_EMOJIS = 28;
const MAX_RECENT_STICKERS = 24;
const MAX_RECENT_GIFS = 20;
const iconProps = { size: 18, strokeWidth: 1.5 } as const;

function needsRichComposerOverlay(text: string) {
  if (!text) {
    return false;
  }

  if (customEmojiTokenPattern.test(text)) {
    customEmojiTokenPattern.lastIndex = 0;
    return true;
  }

  customEmojiTokenPattern.lastIndex = 0;

  return splitGraphemes(text).some((grapheme) => isEmojiCluster(grapheme));
}

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
}: MessageComposerProps) {
  const [content, setContent] = useState("");
  const [isSendingText, setIsSendingText] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<PickerTab>("emoji");
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);
  const [recentGifIds, setRecentGifIds] = useState<string[]>([]);
  const [pendingStickerIds, setPendingStickerIds] = useState<string[]>([]);
  const [pendingGifIds, setPendingGifIds] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const mirrorRef = useRef<HTMLDivElement | null>(null);
  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const documentInputRef = useRef<HTMLInputElement | null>(null);
  const selectionRef = useRef({ start: 0, end: 0 });
  const shouldRenderRichOverlay = useMemo(
    () => needsRichComposerOverlay(content),
    [content],
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
    setRecentEmojis(readRecentStrings(RECENT_EMOJIS_KEY));
    setRecentGifIds(readRecentStrings(RECENT_GIFS_KEY));
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
        textareaRef.current?.focus();
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [pickerOpen]);

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

  function syncMirrorScroll() {
    const textarea = textareaRef.current;
    const mirror = mirrorRef.current;

    if (!textarea || !mirror) {
      return;
    }

    mirror.scrollTop = textarea.scrollTop;
    mirror.scrollLeft = textarea.scrollLeft;
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

    setContent(nextContent);

    if (recentEmoji) {
      pushRecentEmoji(recentEmoji);
    }

    requestAnimationFrame(() => {
      if (!element) {
        return;
      }

      element.focus();
      element.setSelectionRange(nextPosition, nextPosition);
      selectionRef.current = {
        start: nextPosition,
        end: nextPosition,
      };
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

    const trimmed = content.trim();

    if (!trimmed) {
      return;
    }

    setIsSendingText(true);

    try {
      await onSend({
        type: "TEXT",
        content: trimmed,
      });
      setContent("");
      requestAnimationFrame(() => focusTextarea(0));
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

      textareaRef.current?.focus();
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
      textareaRef.current?.focus();
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

  return (
    <>
      <form
        data-composer-picker-root="true"
        data-composer-attach-root="true"
        className="dm-composer-shell"
        onSubmit={handleSubmit}
      >
        {pickerOpen ? (
          <div className="absolute bottom-full left-0 z-50 mb-4 md:left-auto md:right-0">
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
            />
          </div>
        ) : null}

        {attachMenuOpen ? (
          <div className="absolute bottom-[calc(100%-3.5rem)] left-0 z-50 mb-3 w-52 rounded-[18px] border border-white/8 bg-[rgba(10,14,20,0.98)] p-2 shadow-[0_18px_40px_rgba(2,6,12,0.42)]">
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

        <div className="dm-composer-main">
          {shouldRenderRichOverlay ? (
            <div
              ref={mirrorRef}
              aria-hidden
              className="dm-composer-overlay pointer-events-none absolute inset-0 overflow-hidden text-sm leading-[1.44] text-white whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
            >
              <InlineCustomEmojiText
                text={content.endsWith("\n") ? `${content}\u200b` : content}
                customEmojis={pickerCatalog?.customEmojis ?? []}
              />
            </div>
          ) : null}

          <textarea
            ref={textareaRef}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            onInput={syncTextareaHeight}
            onPaste={handlePaste}
            onClick={syncSelection}
            onKeyUp={syncSelection}
            onSelect={syncSelection}
            onScroll={syncMirrorScroll}
            onKeyDown={handleKeyDown}
            placeholder={
              isUploadingFiles
                ? "Загружаем файлы…"
                : disabled
                  ? "В этом диалоге нельзя отправлять сообщения."
                  : "Сообщение"
            }
            disabled={disabled || isSendingText || isUploadingFiles}
            rows={1}
            className={cn(
              "dm-composer-textarea relative block min-h-9 max-h-28 w-full resize-none whitespace-pre-wrap break-words border-none bg-transparent text-sm leading-[1.44] outline-none transition-colors [overflow-wrap:anywhere] disabled:cursor-not-allowed disabled:opacity-60",
              shouldRenderRichOverlay
                ? "text-transparent caret-white"
                : "text-white caret-white placeholder:text-[var(--text-muted)]",
            )}
            style={{
              resize: "none",
              overflowWrap: "anywhere",
              wordBreak: "break-word",
              whiteSpace: "pre-wrap",
            }}
          />
        </div>

        <div className="dm-composer-footer">
          <div className="dm-composer-tools">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={disabled || isUploadingFiles}
              onClick={() => {
                setAttachMenuOpen((current) => !current);
                setPickerOpen(false);
              }}
              className="dm-composer-button px-0"
              aria-label="Прикрепить файл"
            >
              <Paperclip {...iconProps} />
            </Button>

            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={disabled || isUploadingFiles}
              onClick={() => {
                setAttachMenuOpen(false);
                setPickerOpen((current) => !current);
                syncSelection();
                void refreshCatalogIfNeeded();
              }}
              className={cn(
                "dm-composer-button px-0",
                pickerOpen && "dm-action-button-active",
              )}
              aria-label="Открыть смайлики, стикеры и GIF"
            >
              <SmilePlus {...iconProps} />
            </Button>
          </div>

          <Button
            type="submit"
            size="sm"
            disabled={
              disabled || isSendingText || isUploadingFiles || !content.trim()
            }
            className={cn(
              "dm-composer-button dm-composer-send px-0",
              content.trim() && "dm-composer-send-ready",
            )}
            aria-label={
              isSendingText ? "Отправляем сообщение" : "Отправить сообщение"
            }
          >
            <SendHorizontal {...iconProps} />
          </Button>
        </div>
      </form>
    </>
  );
}
