"use client";

import type { StickerAsset, StickerCatalog } from "@lobby/shared";
import { Search, Settings2, SmilePlus, Sticker } from "lucide-react";
import {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { emojiCategories, type EmojiCategoryId, type EmojiEntry } from "./emoji-data";
import { StickerAssetPreview } from "./sticker-asset-preview";

export type PickerTab = "emoji" | "sticker";

interface EmojiStickerPickerProps {
  activeTab: PickerTab;
  recentEmojis: string[];
  stickerCatalog: StickerCatalog | null;
  isStickerCatalogLoading: boolean;
  stickerCatalogError: string | null;
  pendingStickerIds: string[];
  onTabChange: (tab: PickerTab) => void;
  onEmojiSelect: (emoji: string) => void;
  onStickerSelect: (sticker: StickerAsset) => void;
  onRetryStickerCatalog: () => void | Promise<void>;
  onOpenManager: () => void;
}

const allEmojiEntries = emojiCategories.flatMap((category) => category.emojis);

export function EmojiStickerPicker({
  activeTab,
  recentEmojis,
  stickerCatalog,
  isStickerCatalogLoading,
  stickerCatalogError,
  pendingStickerIds,
  onTabChange,
  onEmojiSelect,
  onStickerSelect,
  onRetryStickerCatalog,
  onOpenManager,
}: EmojiStickerPickerProps) {
  const [emojiSearch, setEmojiSearch] = useState("");
  const [selectedEmojiCategory, setSelectedEmojiCategory] =
    useState<EmojiCategoryId>("recent");
  const [stickerSearch, setStickerSearch] = useState("");
  const [selectedStickerSource, setSelectedStickerSource] = useState("recent");
  const deferredEmojiSearch = useDeferredValue(emojiSearch.trim().toLowerCase());
  const deferredStickerSearch = useDeferredValue(stickerSearch.trim().toLowerCase());

  useEffect(() => {
    if (activeTab !== "sticker" || !stickerCatalog) {
      return;
    }

    const hasRecent = stickerCatalog.recent.length > 0;
    const hasPack = stickerCatalog.packs.some((pack) => pack.id === selectedStickerSource);

    if ((selectedStickerSource === "recent" && hasRecent) || hasPack) {
      return;
    }

    setSelectedStickerSource(hasRecent ? "recent" : (stickerCatalog.packs[0]?.id ?? "recent"));
  }, [activeTab, selectedStickerSource, stickerCatalog]);

  const recentEmojiEntries = useMemo(() => {
    const emojiMap = new Map(allEmojiEntries.map((item) => [item.emoji, item]));

    return recentEmojis
      .map((emoji) => emojiMap.get(emoji) ?? createLooseEmojiEntry(emoji))
      .slice(0, 28);
  }, [recentEmojis]);

  const filteredEmojiSections = useMemo(() => {
    if (deferredEmojiSearch) {
      const filtered = allEmojiEntries.filter((item) =>
        [item.label, ...item.keywords].some((candidate) =>
          candidate.toLowerCase().includes(deferredEmojiSearch),
        ),
      );

      return filtered.length > 0
        ? [{ id: "search", label: "Результаты", emojis: filtered }]
        : [];
    }

    if (selectedEmojiCategory === "recent") {
      return recentEmojiEntries.length > 0
        ? [{ id: "recent", label: "Недавние", emojis: recentEmojiEntries }]
        : emojiCategories;
    }

    return emojiCategories.filter((category) => category.id === selectedEmojiCategory);
  }, [deferredEmojiSearch, recentEmojiEntries, selectedEmojiCategory]);

  const pickerPacks = useMemo(() => {
    if (!stickerCatalog) {
      return [];
    }

    const latestUsageByPackId = new Map(
      stickerCatalog.recent.map((item) => [
        item.packId,
        new Date(item.usedAt).getTime(),
      ]),
    );

    return [...stickerCatalog.packs].sort((left, right) => {
      const leftUsage = latestUsageByPackId.get(left.id) ?? 0;
      const rightUsage = latestUsageByPackId.get(right.id) ?? 0;

      if (leftUsage !== rightUsage) {
        return rightUsage - leftUsage;
      }

      return left.sortOrder - right.sortOrder;
    });
  }, [stickerCatalog]);

  const stickerResults = useMemo(() => {
    if (!stickerCatalog || !deferredStickerSearch) {
      return [];
    }

    return stickerCatalog.packs.flatMap((pack) =>
      pack.stickers
        .filter((sticker) =>
          [sticker.title, sticker.originalName ?? "", pack.title].some((candidate) =>
            candidate.toLowerCase().includes(deferredStickerSearch),
          ),
        )
        .map((sticker) => ({
          sticker,
          packTitle: pack.title,
        })),
    );
  }, [deferredStickerSearch, stickerCatalog]);

  const visibleStickers = useMemo(() => {
    if (!stickerCatalog) {
      return [];
    }

    if (deferredStickerSearch) {
      return stickerResults;
    }

    if (selectedStickerSource === "recent") {
      return stickerCatalog.recent.map((item) => ({
        sticker: item.sticker,
        packTitle: item.packTitle,
      }));
    }

    const pack = pickerPacks.find((item) => item.id === selectedStickerSource);

    return (pack?.stickers ?? []).map((sticker) => ({
      sticker,
      packTitle: pack?.title ?? "Стикеры",
    }));
  }, [
    deferredStickerSearch,
    pickerPacks,
    selectedStickerSource,
    stickerCatalog,
    stickerResults,
  ]);

  return (
    <div className="flex h-[min(68vh,520px)] w-[min(92vw,404px)] flex-col overflow-hidden rounded-[22px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),transparent_18%),rgba(8,12,18,0.98)] shadow-[0_26px_80px_rgba(2,6,12,0.45)] backdrop-blur-xl">
      <div className="flex items-center gap-1 border-b border-white/6 p-2">
        <PickerTabButton
          active={activeTab === "emoji"}
          label="Смайлики"
          icon={<SmilePlus size={16} strokeWidth={1.5} />}
          onClick={() => onTabChange("emoji")}
        />
        <PickerTabButton
          active={activeTab === "sticker"}
          label="Стикеры"
          icon={<Sticker size={16} strokeWidth={1.5} />}
          onClick={() => onTabChange("sticker")}
        />
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="ml-auto h-9 rounded-[12px] px-3"
          onClick={onOpenManager}
        >
          <Settings2 size={16} strokeWidth={1.5} />
          Управление
        </Button>
      </div>

      <div className="border-b border-white/6 px-3 py-2.5">
        <label className="flex items-center gap-2 rounded-[14px] border border-white/8 bg-white/[0.03] px-3 text-[var(--text-muted)]">
          <Search size={16} strokeWidth={1.5} className="shrink-0" />
          <Input
            value={activeTab === "emoji" ? emojiSearch : stickerSearch}
            onChange={(event) =>
              activeTab === "emoji"
                ? setEmojiSearch(event.target.value)
                : setStickerSearch(event.target.value)
            }
            placeholder={activeTab === "emoji" ? "Поиск смайликов" : "Поиск стикеров"}
            className="h-9 border-0 bg-transparent px-0 text-sm text-white"
          />
        </label>
      </div>

      {activeTab === "emoji" ? (
        <>
          <div className="flex gap-1 overflow-x-auto border-b border-white/6 px-2 py-2">
            <EmojiCategoryButton
              active={selectedEmojiCategory === "recent"}
              label="Недавние"
              onClick={() => setSelectedEmojiCategory("recent")}
            />
            {emojiCategories.map((category) => (
              <EmojiCategoryButton
                key={category.id}
                active={selectedEmojiCategory === category.id}
                label={category.label}
                onClick={() => setSelectedEmojiCategory(category.id)}
              />
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
            {filteredEmojiSections.length === 0 ? (
              <div className="flex h-full items-center justify-center text-center text-sm text-[var(--text-muted)]">
                Ничего не найдено.
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredEmojiSections.map((section) => (
                  <section key={section.id} className="grid gap-2">
                    <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--text-muted)]">
                      {section.label}
                    </div>
                    <div className="grid grid-cols-8 gap-1.5">
                      {section.emojis.map((item) => (
                        <button
                          key={`${section.id}-${item.emoji}`}
                          type="button"
                          onMouseDown={preventFocusLoss}
                          onClick={() => onEmojiSelect(item.emoji)}
                          className="flex h-10 items-center justify-center rounded-[12px] border border-transparent bg-white/[0.02] text-[22px] transition-colors hover:border-white/8 hover:bg-white/[0.06]"
                          title={item.label}
                        >
                          <span aria-hidden>{item.emoji}</span>
                          <span className="sr-only">{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="flex gap-1 overflow-x-auto border-b border-white/6 px-2 py-2">
            {stickerCatalog?.recent.length ? (
              <SourceButton
                active={selectedStickerSource === "recent"}
                label="Недавние"
                onClick={() => setSelectedStickerSource("recent")}
              />
            ) : null}
            {pickerPacks.map((pack) => (
              <SourceButton
                key={pack.id}
                active={selectedStickerSource === pack.id}
                label={pack.title}
                onClick={() => setSelectedStickerSource(pack.id)}
              />
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
            {isStickerCatalogLoading && !stickerCatalog ? (
              <PickerState>Загружаем стикеры...</PickerState>
            ) : stickerCatalogError ? (
              <div className="grid h-full place-items-center gap-3 text-center">
                <p className="text-sm text-rose-200">{stickerCatalogError}</p>
                <Button type="button" size="sm" onClick={() => void onRetryStickerCatalog()}>
                  Повторить
                </Button>
              </div>
            ) : stickerCatalog && stickerCatalog.packs.length === 0 && stickerCatalog.recent.length === 0 ? (
              <div className="grid h-full place-items-center gap-3 text-center">
                <div>
                  <p className="text-sm font-medium text-white">Паков пока нет</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    Создайте набор и загрузите первые стикеры.
                  </p>
                </div>
                <Button type="button" className="h-9 rounded-[14px] px-3" onClick={onOpenManager}>
                  Создать набор
                </Button>
              </div>
            ) : visibleStickers.length === 0 ? (
              <PickerState>
                {deferredStickerSearch
                  ? "По запросу ничего не нашлось."
                  : selectedStickerSource === "recent"
                    ? "Недавних стикеров пока нет."
                    : "В этом наборе пока нет стикеров."}
              </PickerState>
            ) : (
              <div className="grid grid-cols-3 gap-2.5">
                {visibleStickers.map((item) => {
                  const pending = pendingStickerIds.includes(item.sticker.id);

                  return (
                    <button
                      key={`${item.packTitle}-${item.sticker.id}`}
                      type="button"
                      disabled={pending}
                      onMouseDown={preventFocusLoss}
                      onClick={() => onStickerSelect(item.sticker)}
                      className="group grid gap-1 rounded-[18px] border border-white/8 bg-white/[0.03] p-2 text-left transition-colors hover:border-white/14 hover:bg-white/[0.05] disabled:cursor-wait disabled:opacity-60"
                      title={`${item.packTitle}: ${item.sticker.title}`}
                    >
                      <StickerAssetPreview
                        sticker={item.sticker}
                        className="aspect-square rounded-[14px] bg-[radial-gradient(circle_at_top,rgba(106,168,248,0.08),transparent_55%),rgba(255,255,255,0.03)]"
                        imageClassName="pointer-events-none"
                      />
                      <div className="min-w-0">
                        <div className="truncate text-[11px] font-medium text-white">
                          {pending ? "Отправляем..." : item.sticker.title}
                        </div>
                        <div className="truncate text-[10px] text-[var(--text-muted)]">
                          {item.packTitle}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function PickerTabButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onMouseDown={preventFocusLoss}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-[12px] px-3 text-sm transition-colors",
        active
          ? "border border-white/10 bg-white/[0.08] text-white"
          : "border border-transparent text-[var(--text-muted)] hover:bg-white/[0.04] hover:text-white",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function EmojiCategoryButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onMouseDown={preventFocusLoss}
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors",
        active
          ? "border-white/12 bg-white/[0.08] text-white"
          : "border-white/6 bg-white/[0.03] text-[var(--text-muted)] hover:text-white",
      )}
    >
      {label}
    </button>
  );
}

function SourceButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onMouseDown={preventFocusLoss}
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors",
        active
          ? "border-white/12 bg-white/[0.08] text-white"
          : "border-white/6 bg-white/[0.03] text-[var(--text-muted)] hover:text-white",
      )}
    >
      {label}
    </button>
  );
}

function PickerState({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center text-center text-sm text-[var(--text-muted)]">
      <div>{children}</div>
    </div>
  );
}

function createLooseEmojiEntry(emoji: string): EmojiEntry {
  return {
    emoji,
    label: emoji,
    keywords: [],
  };
}

function preventFocusLoss(event: MouseEvent) {
  event.preventDefault();
}
