"use client";

/* eslint-disable @next/next/no-img-element */
import type {
  CustomEmojiAsset,
  EmojiCategoryId,
  EmojiTone,
  GifAsset,
  MediaPickerCatalog,
  StickerAsset,
} from "@lobby/shared";
import { Film, Search, Settings2, SmilePlus, Sticker } from "lucide-react";
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
import {
  getCustomEmojiAssetUrl,
  getGifAssetUrl,
} from "@/lib/stickers";
import { EmojiGlyph } from "@/lib/emoji/emoji-glyph";
import { cn } from "@/lib/utils";
import {
  emojiCategories,
  emojiToneOptions,
  type EmojiEntry,
} from "./emoji-data";
import { GifAssetPreview } from "./gif-asset-preview";
import { StickerAssetPreview } from "./sticker-asset-preview";

export type PickerTab = "emoji" | "sticker" | "gif";

interface EmojiStickerPickerProps {
  activeTab: PickerTab;
  recentEmojis: string[];
  recentGifIds: string[];
  catalog: MediaPickerCatalog | null;
  isCatalogLoading: boolean;
  catalogError: string | null;
  pendingStickerIds: string[];
  pendingGifIds: string[];
  canManageLibrary: boolean;
  onTabChange: (tab: PickerTab) => void;
  onEmojiSelect: (emoji: string) => void;
  onCustomEmojiSelect: (emoji: CustomEmojiAsset) => void;
  onStickerSelect: (sticker: StickerAsset) => void;
  onGifSelect: (gif: GifAsset) => void;
  onRetryCatalog: () => void | Promise<void>;
  onOpenManager: () => void;
}

type ExtendedEmojiCategoryId = EmojiCategoryId | "custom";

const allEmojiEntries = emojiCategories.flatMap((category) => category.emojis);
const EMOJI_TONE_STORAGE_KEY = "lobby:dm:emoji-tone";

export function EmojiStickerPicker({
  activeTab,
  recentEmojis,
  recentGifIds,
  catalog,
  isCatalogLoading,
  catalogError,
  pendingStickerIds,
  pendingGifIds,
  canManageLibrary,
  onTabChange,
  onEmojiSelect,
  onCustomEmojiSelect,
  onStickerSelect,
  onGifSelect,
  onRetryCatalog,
  onOpenManager,
}: EmojiStickerPickerProps) {
  const [emojiSearch, setEmojiSearch] = useState("");
  const [selectedEmojiCategory, setSelectedEmojiCategory] =
    useState<ExtendedEmojiCategoryId>("recent");
  const [selectedTone, setSelectedTone] = useState<EmojiTone>("default");
  const [stickerSearch, setStickerSearch] = useState("");
  const [selectedStickerSource, setSelectedStickerSource] = useState("recent");
  const [gifSearch, setGifSearch] = useState("");
  const deferredEmojiSearch = useDeferredValue(emojiSearch.trim().toLowerCase());
  const deferredStickerSearch = useDeferredValue(stickerSearch.trim().toLowerCase());
  const deferredGifSearch = useDeferredValue(gifSearch.trim().toLowerCase());

  useEffect(() => {
    if (activeTab !== "sticker" || !catalog) {
      return;
    }

    const hasRecent = catalog.stickers.recent.length > 0;
    const hasPack = catalog.stickers.packs.some((pack) => pack.id === selectedStickerSource);

    if ((selectedStickerSource === "recent" && hasRecent) || hasPack) {
      return;
    }

    setSelectedStickerSource(
      hasRecent ? "recent" : (catalog.stickers.packs[0]?.id ?? "recent"),
    );
  }, [activeTab, catalog, selectedStickerSource]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const stored = window.localStorage.getItem(EMOJI_TONE_STORAGE_KEY);

    if (
      stored === "default" ||
      stored === "light" ||
      stored === "medium-light" ||
      stored === "medium" ||
      stored === "medium-dark" ||
      stored === "dark"
    ) {
      setSelectedTone(stored);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(EMOJI_TONE_STORAGE_KEY, selectedTone);
    }
  }, [selectedTone]);

  const recentEmojiEntries = useMemo(() => {
    const emojiMap = new Map(allEmojiEntries.map((item) => [item.emoji, item]));

    return recentEmojis
      .map((emoji) => emojiMap.get(emoji) ?? createLooseEmojiEntry(emoji))
      .slice(0, 28);
  }, [recentEmojis]);

  const filteredCustomEmojis = useMemo(() => {
    const items = catalog?.customEmojis ?? [];

    if (!deferredEmojiSearch) {
      return items;
    }

    return items.filter((emoji) =>
      [emoji.alias, emoji.title].some((candidate) =>
        candidate.toLowerCase().includes(deferredEmojiSearch),
      ),
    );
  }, [catalog?.customEmojis, deferredEmojiSearch]);

  const filteredEmojiSections = useMemo(() => {
    if (deferredEmojiSearch) {
      const filtered = allEmojiEntries.filter((item) =>
        [item.label, ...item.keywords].some((candidate) =>
          candidate.toLowerCase().includes(deferredEmojiSearch),
        ),
      );

      return {
        system:
          filtered.length > 0
            ? [{ id: "search", label: "Результаты", emojis: filtered }]
            : [],
        custom: filteredCustomEmojis,
      };
    }

    if (selectedEmojiCategory === "custom") {
      return {
        system: [],
        custom: filteredCustomEmojis,
      };
    }

    if (selectedEmojiCategory === "recent") {
      return {
        system:
          recentEmojiEntries.length > 0
            ? [{ id: "recent", label: "Недавние", emojis: recentEmojiEntries }]
            : emojiCategories,
        custom: filteredCustomEmojis,
      };
    }

    return {
      system: emojiCategories.filter((category) => category.id === selectedEmojiCategory),
      custom: filteredCustomEmojis,
    };
  }, [
    deferredEmojiSearch,
    filteredCustomEmojis,
    recentEmojiEntries,
    selectedEmojiCategory,
  ]);

  const pickerPacks = useMemo(() => {
    if (!catalog) {
      return [];
    }

    const latestUsageByPackId = new Map(
      catalog.stickers.recent.map((item) => [
        item.packId,
        new Date(item.usedAt).getTime(),
      ]),
    );

    return [...catalog.stickers.packs].sort((left, right) => {
      const leftUsage = latestUsageByPackId.get(left.id) ?? 0;
      const rightUsage = latestUsageByPackId.get(right.id) ?? 0;

      if (leftUsage !== rightUsage) {
        return rightUsage - leftUsage;
      }

      return left.sortOrder - right.sortOrder;
    });
  }, [catalog]);

  const stickerResults = useMemo(() => {
    if (!catalog || !deferredStickerSearch) {
      return [];
    }

    return catalog.stickers.packs.flatMap((pack) =>
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
  }, [catalog, deferredStickerSearch]);

  const visibleStickers = useMemo(() => {
    if (!catalog) {
      return [];
    }

    if (deferredStickerSearch) {
      return stickerResults;
    }

    if (selectedStickerSource === "recent") {
      return catalog.stickers.recent.map((item) => ({
        sticker: item.sticker,
        packTitle: item.packTitle,
      }));
    }

    const pack = pickerPacks.find((item) => item.id === selectedStickerSource);

    return (pack?.stickers ?? []).map((sticker) => ({
      sticker,
      packTitle: pack?.title ?? "Стикеры",
    }));
  }, [catalog, deferredStickerSearch, pickerPacks, selectedStickerSource, stickerResults]);

  const gifSections = useMemo(() => {
    if (!catalog) {
      return {
        recent: [] as GifAsset[],
        items: [] as GifAsset[],
      };
    }

    const filtered = deferredGifSearch
      ? catalog.gifs.filter((gif) =>
          [gif.title, ...gif.tags].some((candidate) =>
            candidate.toLowerCase().includes(deferredGifSearch),
          ),
        )
      : catalog.gifs;
    const recentOrder = new Map(recentGifIds.map((id, index) => [id, index]));
    const recent = filtered
      .filter((gif) => recentOrder.has(gif.id))
      .sort((left, right) => (recentOrder.get(left.id) ?? 0) - (recentOrder.get(right.id) ?? 0));

    return {
      recent,
      items: filtered,
    };
  }, [catalog, deferredGifSearch, recentGifIds]);

  return (
    <div className="flex h-[min(70vh,560px)] w-[min(92vw,408px)] flex-col overflow-hidden rounded-[24px] border border-white/10 bg-[#091019] shadow-[0_32px_90px_rgba(2,6,12,0.72)] ring-1 ring-black/35">
      <div className="flex items-center gap-1 border-b border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] px-2 py-2">
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
        <PickerTabButton
          active={activeTab === "gif"}
          label="GIF"
          icon={<Film size={16} strokeWidth={1.5} />}
          onClick={() => onTabChange("gif")}
        />
        {canManageLibrary ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="ml-auto h-9 rounded-[12px] px-3 text-[var(--text-soft)]"
            onClick={onOpenManager}
          >
            <Settings2 size={16} strokeWidth={1.5} />
            Управление
          </Button>
        ) : null}
      </div>

      <div className="border-b border-white/8 px-3 py-2.5">
        <label className="flex items-center gap-2 rounded-[14px] border border-white/10 bg-black/20 px-3 text-[var(--text-muted)] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
          <Search size={16} strokeWidth={1.5} className="shrink-0" />
          <Input
            value={
              activeTab === "emoji"
                ? emojiSearch
                : activeTab === "sticker"
                  ? stickerSearch
                  : gifSearch
            }
            onChange={(event) => {
              if (activeTab === "emoji") {
                setEmojiSearch(event.target.value);
                return;
              }

              if (activeTab === "sticker") {
                setStickerSearch(event.target.value);
                return;
              }

              setGifSearch(event.target.value);
            }}
            placeholder={
              activeTab === "emoji"
                ? "Поиск смайликов"
                : activeTab === "sticker"
                  ? "Поиск стикеров"
                  : "Поиск GIF"
            }
            className="h-9 border-0 bg-transparent px-0 text-sm text-white"
          />
        </label>
      </div>

      {activeTab === "emoji" ? (
        <>
          <div className="flex gap-1 overflow-x-auto border-b border-white/8 px-2 py-2">
            <EmojiCategoryButton
              active={selectedEmojiCategory === "recent"}
              label="Недавние"
              onClick={() => setSelectedEmojiCategory("recent")}
            />
            {catalog?.customEmojis.length ? (
              <EmojiCategoryButton
                active={selectedEmojiCategory === "custom"}
                label="Кастомные"
                onClick={() => setSelectedEmojiCategory("custom")}
              />
            ) : null}
            {emojiCategories.map((category) => (
              <EmojiCategoryButton
                key={category.id}
                active={selectedEmojiCategory === category.id}
                label={category.label}
                onClick={() => setSelectedEmojiCategory(category.id)}
              />
            ))}
          </div>

          <div className="flex gap-1 overflow-x-auto border-b border-white/8 px-2 py-2">
            {emojiToneOptions.map((tone) => (
              <EmojiCategoryButton
                key={tone.id}
                active={selectedTone === tone.id}
                label={tone.label}
                onClick={() => setSelectedTone(tone.id)}
              />
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
            {filteredEmojiSections.system.length === 0 && filteredEmojiSections.custom.length === 0 ? (
              <PickerState>Ничего не найдено.</PickerState>
            ) : (
              <div className="grid gap-4">
                {filteredEmojiSections.custom.length > 0 ? (
                  <section className="grid gap-2">
                    <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--text-muted)]">
                      Кастомные
                    </div>
                    <div className="grid grid-cols-7 gap-1.5">
                      {filteredEmojiSections.custom.map((emoji) => (
                        <button
                          key={emoji.id}
                          type="button"
                          onMouseDown={preventFocusLoss}
                          onClick={() => onCustomEmojiSelect(emoji)}
                          className="flex h-11 items-center justify-center rounded-[12px] border border-transparent bg-white/[0.03] transition-colors hover:border-white/10 hover:bg-white/[0.08]"
                          title={`:${emoji.alias}:`}
                        >
                          <img
                            src={getCustomEmojiAssetUrl(emoji)}
                            alt={emoji.title}
                            className="h-7 w-7 object-contain"
                            draggable={false}
                            loading="lazy"
                          />
                        </button>
                      ))}
                    </div>
                  </section>
                ) : null}

                {filteredEmojiSections.system.map((section) => (
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
                          onClick={() => onEmojiSelect(resolveEmojiTone(item, selectedTone))}
                          className="flex h-10 items-center justify-center rounded-[12px] border border-transparent bg-white/[0.02] text-[22px] transition-colors hover:border-white/8 hover:bg-white/[0.06]"
                          title={item.label}
                        >
                          <EmojiGlyph
                            emoji={resolveEmojiTone(item, selectedTone)}
                            label={item.label}
                            className="h-6 w-6"
                            fallbackClassName="text-[22px]"
                          />
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
      ) : activeTab === "sticker" ? (
        <>
          <div className="flex gap-1 overflow-x-auto border-b border-white/8 px-2 py-2">
            {catalog?.stickers.recent.length ? (
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
            {isCatalogLoading && !catalog ? (
              <PickerState>Загружаем стикеры...</PickerState>
            ) : catalogError ? (
              <ErrorState message={catalogError} onRetry={onRetryCatalog} />
            ) : catalog && catalog.stickers.packs.length === 0 && catalog.stickers.recent.length === 0 ? (
              <div className="grid h-full place-items-center gap-3 text-center">
                <div>
                  <p className="text-sm font-medium text-white">Паков пока нет</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    Сначала создайте набор и загрузите первые стикеры.
                  </p>
                </div>
                {canManageLibrary ? (
                  <Button
                    type="button"
                    className="h-9 rounded-[14px] px-3"
                    onClick={onOpenManager}
                  >
                    Создать набор
                  </Button>
                ) : null}
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
              <div className="grid grid-cols-2 gap-2">
                {visibleStickers.map(({ sticker, packTitle }) => {
                  const isPending = pendingStickerIds.includes(sticker.id);

                  return (
                    <button
                      key={sticker.id}
                      type="button"
                      onMouseDown={preventFocusLoss}
                      onClick={() => onStickerSelect(sticker)}
                      disabled={isPending}
                      className="group rounded-[18px] border border-white/8 bg-white/[0.03] p-2 text-left transition-colors hover:border-white/12 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-60"
                      title={`${packTitle} · ${sticker.title}`}
                    >
                      <StickerAssetPreview
                        sticker={sticker}
                        className="aspect-square rounded-[18px] bg-[radial-gradient(circle_at_top,rgba(106,168,248,0.12),transparent_55%),rgba(255,255,255,0.03)]"
                      />
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="truncate text-[11px] text-[var(--text-muted)]">
                          {packTitle}
                        </span>
                        <span className="text-[11px] text-white/70">
                          {isPending ? "..." : ""}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {isCatalogLoading && !catalog ? (
            <PickerState>Загружаем GIF...</PickerState>
          ) : catalogError ? (
            <ErrorState message={catalogError} onRetry={onRetryCatalog} />
          ) : !catalog || catalog.gifs.length === 0 ? (
            <div className="grid h-full place-items-center gap-3 text-center">
              <div>
                <p className="text-sm font-medium text-white">GIF пока нет</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Загрузите первые GIF в библиотеку, чтобы отправлять их в 1 клик.
                </p>
              </div>
              {canManageLibrary ? (
                <Button type="button" className="h-9 rounded-[14px] px-3" onClick={onOpenManager}>
                  Открыть библиотеку
                </Button>
              ) : null}
            </div>
          ) : gifSections.items.length === 0 ? (
            <PickerState>По запросу ничего не нашлось.</PickerState>
          ) : (
            <div className="grid gap-4">
              {gifSections.recent.length > 0 && !deferredGifSearch ? (
                <section className="grid gap-2">
                  <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--text-muted)]">
                    Недавние
                  </div>
                  <div className="grid gap-2">
                    {gifSections.recent.slice(0, 4).map((gif) => (
                      <GifPickerCard
                        key={`recent-${gif.id}`}
                        gif={gif}
                        isPending={pendingGifIds.includes(gif.id)}
                        onSelect={onGifSelect}
                      />
                    ))}
                  </div>
                </section>
              ) : null}

              <section className="grid gap-2">
                <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  Библиотека
                </div>
                <div className="grid gap-2">
                  {gifSections.items.map((gif) => (
                    <GifPickerCard
                      key={gif.id}
                      gif={gif}
                      isPending={pendingGifIds.includes(gif.id)}
                      onSelect={onGifSelect}
                    />
                  ))}
                </div>
              </section>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GifPickerCard({
  gif,
  isPending,
  onSelect,
}: {
  gif: GifAsset;
  isPending: boolean;
  onSelect: (gif: GifAsset) => void;
}) {
  return (
    <button
      type="button"
      onMouseDown={preventFocusLoss}
      onClick={() => onSelect(gif)}
      disabled={isPending}
      className="overflow-hidden rounded-[18px] border border-white/8 bg-white/[0.03] text-left transition-colors hover:border-white/12 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-60"
      title={gif.title}
    >
      <GifAssetPreview
        gif={gif}
        className="aspect-[4/3] rounded-none"
        showBadge
      />
      <div className="flex items-center justify-between gap-3 px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">{gif.title}</p>
          <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">
            {gif.tags.length > 0 ? gif.tags.join(" · ") : "Без тегов"}
          </p>
        </div>
        {isPending ? (
          <span className="text-[11px] uppercase tracking-[0.14em] text-[var(--accent)]">
            ...
          </span>
        ) : null}
      </div>
    </button>
  );
}

function PickerTabButton({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-[14px] border px-3 text-sm font-medium transition-colors",
        active
          ? "border-white/14 bg-white/[0.08] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
          : "border-transparent bg-transparent text-[var(--text-muted)] hover:bg-white/[0.04] hover:text-white",
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
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-white/14 bg-white/[0.08] text-white"
          : "border-transparent bg-transparent text-[var(--text-muted)] hover:bg-white/[0.05] hover:text-white",
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
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-white/14 bg-white/[0.08] text-white"
          : "border-transparent bg-transparent text-[var(--text-muted)] hover:bg-white/[0.05] hover:text-white",
      )}
    >
      {label}
    </button>
  );
}

function PickerState({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center text-center text-sm text-[var(--text-muted)]">
      <div className="max-w-[240px]">{children}</div>
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void | Promise<void>;
}) {
  return (
    <div className="grid h-full place-items-center gap-3 text-center">
      <p className="max-w-[260px] text-sm text-rose-200">{message}</p>
      <Button type="button" size="sm" onClick={() => void onRetry()}>
        Повторить
      </Button>
    </div>
  );
}

function preventFocusLoss(event: MouseEvent<HTMLElement>) {
  event.preventDefault();
}

function createLooseEmojiEntry(emoji: string): EmojiEntry {
  return {
    emoji,
    label: emoji,
    keywords: [],
    category: "symbols",
  };
}

function resolveEmojiTone(entry: EmojiEntry, tone: EmojiTone): string {
  return entry.toneVariants?.[tone] ?? entry.emoji;
}
