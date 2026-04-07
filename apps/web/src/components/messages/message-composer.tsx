"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { SendHorizontal, SmilePlus } from "lucide-react";
import {
  stickerCatalogResponseSchema,
  type StickerAsset,
  type StickerCatalog,
} from "@lobby/shared";
import { Button } from "@/components/ui/button";
import { apiClientFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import {
  EmojiStickerPicker,
  type PickerTab,
} from "./emoji-sticker-picker";
import { StickerPackManagerModal } from "./sticker-pack-manager-modal";

export type ComposerSendPayload =
  | { type: "TEXT"; content: string }
  | { type: "STICKER"; stickerId: string; sticker: StickerAsset };

interface MessageComposerProps {
  disabled: boolean;
  onSend: (payload: ComposerSendPayload) => Promise<void>;
}

const BASE_HEIGHT = 38;
const MAX_HEIGHT = 112;
const RECENT_EMOJIS_KEY = "lobby:dm:recent-emojis";
const MAX_RECENT_EMOJIS = 28;
const MAX_RECENT_STICKERS = 24;
const iconProps = { size: 18, strokeWidth: 1.5 } as const;

function readRecentEmojis() {
  if (typeof window === "undefined") {
    return [] as string[];
  }

  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(RECENT_EMOJIS_KEY) ?? "[]",
    );

    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function writeRecentEmojis(nextItems: string[]) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(RECENT_EMOJIS_KEY, JSON.stringify(nextItems));
  }
}

function moveStickerToRecent(
  catalog: StickerCatalog | null,
  sticker: StickerAsset,
): StickerCatalog | null {
  if (!catalog) {
    return catalog;
  }

  const packTitle =
    catalog.packs.find((pack) => pack.id === sticker.packId)?.title ?? "Стикеры";
  const nextRecent = [
    {
      packId: sticker.packId,
      packTitle,
      usedAt: new Date().toISOString(),
      usageCount:
        (catalog.recent.find((item) => item.sticker.id === sticker.id)?.usageCount ?? 0) +
        1,
      sticker,
    },
    ...catalog.recent.filter((item) => item.sticker.id !== sticker.id),
  ].slice(0, MAX_RECENT_STICKERS);

  return {
    ...catalog,
    recent: nextRecent,
  };
}

export function MessageComposer({ disabled, onSend }: MessageComposerProps) {
  const [content, setContent] = useState("");
  const [isSendingText, setIsSendingText] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<PickerTab>("emoji");
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);
  const [stickerCatalog, setStickerCatalog] = useState<StickerCatalog | null>(null);
  const [isStickerCatalogLoading, setIsStickerCatalogLoading] = useState(false);
  const [stickerCatalogError, setStickerCatalogError] = useState<string | null>(null);
  const [pendingStickerIds, setPendingStickerIds] = useState<string[]>([]);
  const [isManagerOpen, setIsManagerOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const composerRef = useRef<HTMLFormElement | null>(null);
  const selectionRef = useRef({ start: 0, end: 0 });

  const refreshStickerCatalog = useCallback(async () => {
    setIsStickerCatalogLoading(true);

    try {
      const payload = await apiClientFetch("/v1/stickers/me");
      const catalog = stickerCatalogResponseSchema.parse(payload).catalog;
      setStickerCatalog(catalog);
      setStickerCatalogError(null);

      return catalog;
    } catch (error) {
      setStickerCatalogError(
        error instanceof Error ? error.message : "Не удалось загрузить стикеры.",
      );
      return null;
    } finally {
      setIsStickerCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    setRecentEmojis(readRecentEmojis());
  }, []);

  useEffect(() => {
    const element = textareaRef.current;

    if (!element) {
      return;
    }

    element.style.height = `${BASE_HEIGHT}px`;
    const nextHeight = Math.min(element.scrollHeight, MAX_HEIGHT);
    element.style.height = `${nextHeight}px`;
    element.style.overflowY = element.scrollHeight > MAX_HEIGHT ? "auto" : "hidden";
  }, [content]);

  useEffect(() => {
    if (!pickerOpen || activeTab !== "sticker" || stickerCatalog || isStickerCatalogLoading) {
      return;
    }

    void refreshStickerCatalog();
  }, [activeTab, isStickerCatalogLoading, pickerOpen, stickerCatalog, refreshStickerCatalog]);

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
      const nextItems = [emoji, ...current.filter((item) => item !== emoji)].slice(
        0,
        MAX_RECENT_EMOJIS,
      );
      writeRecentEmojis(nextItems);
      return nextItems;
    });
  }

  function insertEmoji(emoji: string) {
    const element = textareaRef.current;
    const { start, end } = selectionRef.current;
    const before = content.slice(0, start);
    const after = content.slice(end);
    const nextContent = `${before}${emoji}${after}`;
    const nextPosition = start + emoji.length;

    setContent(nextContent);
    pushRecentEmoji(emoji);

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
      setStickerCatalog((current) => moveStickerToRecent(current, sticker));
      textareaRef.current?.focus();
    } finally {
      setPendingStickerIds((current) => current.filter((item) => item !== sticker.id));
    }
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    syncSelection();

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSubmit(event as unknown as FormEvent<HTMLFormElement>);
    }
  }

  return (
    <>
      <form
        ref={composerRef}
        data-composer-picker-root="true"
        className="relative flex items-end gap-2 rounded-[20px] border border-white/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent_44%),rgba(18,25,36,0.94)] px-2.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]"
        onSubmit={handleSubmit}
      >
        {pickerOpen ? (
          <div className="absolute bottom-full right-0 z-20 mb-3">
            <EmojiStickerPicker
              activeTab={activeTab}
              recentEmojis={recentEmojis}
              stickerCatalog={stickerCatalog}
              isStickerCatalogLoading={isStickerCatalogLoading}
              stickerCatalogError={stickerCatalogError}
              pendingStickerIds={pendingStickerIds}
              onTabChange={(tab) => {
                setActiveTab(tab);

                if (tab === "sticker" && !stickerCatalog) {
                  void refreshStickerCatalog();
                }
              }}
              onEmojiSelect={insertEmoji}
              onStickerSelect={(sticker) => void handleStickerSelect(sticker)}
              onRetryStickerCatalog={() => void refreshStickerCatalog()}
              onOpenManager={() => {
                setIsManagerOpen(true);
                if (!stickerCatalog) {
                  void refreshStickerCatalog();
                }
              }}
            />
          </div>
        ) : null}

        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={disabled}
          onClick={() => {
            setPickerOpen((current) => !current);
            setActiveTab((current) => current);
            syncSelection();
          }}
          className="h-9 w-9 shrink-0 rounded-full border border-white/6 bg-white/[0.03] px-0 text-[var(--text-soft)] hover:bg-white/[0.08] hover:text-white"
          aria-label="Открыть смайлики и стикеры"
        >
          <SmilePlus {...iconProps} />
        </Button>

        <textarea
          ref={textareaRef}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          onClick={syncSelection}
          onKeyUp={syncSelection}
          onSelect={syncSelection}
          onKeyDown={handleKeyDown}
          placeholder={
            disabled ? "В этом диалоге нельзя отправлять сообщения." : "Сообщение"
          }
          disabled={disabled || isSendingText}
          rows={1}
          className="block min-h-9 max-h-28 flex-1 resize-none rounded-[16px] border-none bg-transparent px-3 py-2 text-sm leading-[1.4] text-white outline-none transition-colors placeholder:text-[var(--text-muted)] disabled:cursor-not-allowed disabled:opacity-60"
        />

        <Button
          type="submit"
          size="sm"
          disabled={disabled || isSendingText || !content.trim()}
          className={cn(
            "h-9 w-9 rounded-full border border-white/8 px-0 shadow-[0_10px_20px_rgba(8,16,26,0.18)]",
            content.trim()
              ? "bg-[var(--accent)] hover:bg-[var(--accent-strong)]"
              : "bg-white/[0.08] text-[var(--text-muted)]",
          )}
          aria-label={isSendingText ? "Отправляем сообщение" : "Отправить сообщение"}
        >
          <SendHorizontal {...iconProps} />
        </Button>
      </form>

      <StickerPackManagerModal
        open={isManagerOpen}
        catalog={stickerCatalog}
        onClose={() => {
          setIsManagerOpen(false);
          void refreshStickerCatalog();
        }}
        onCatalogChange={setStickerCatalog}
        onRefreshCatalog={refreshStickerCatalog}
      />
    </>
  );
}
