"use client";

import type { StickerPack } from "@lobby/shared";
import { KebabMenu, StatusBadge } from "@/components/admin/sticker-admin-ui";
import { StickerAssetPreview } from "@/components/messages/sticker-asset-preview";
import { cn } from "@/lib/utils";

interface StickerPackListItemProps {
  pack: StickerPack;
  selected: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}

export function StickerPackListItem({
  pack,
  selected,
  canMoveUp,
  canMoveDown,
  onSelect,
  onEdit,
  onMoveUp,
  onMoveDown,
  onDelete,
}: StickerPackListItemProps) {
  const coverSticker =
    pack.stickers.find((sticker) => sticker.id === pack.coverStickerId) ??
    pack.stickers[0] ??
    null;
  const subtitle = pack.description?.trim() || `/${pack.slug}`;
  const updatedLabel = shortDateFormatter.format(new Date(pack.updatedAt));

  return (
    <div
      className={cn(
        "group relative rounded-[22px] border p-[1px] transition-[transform,border-color,box-shadow,background] duration-200",
        selected
          ? "border-[color:var(--sw-border-strong)] bg-[linear-gradient(135deg,rgba(77,141,255,0.24),rgba(34,197,139,0.08)_58%,transparent)] shadow-[var(--sw-shadow-glow)]"
          : "border-[color:var(--sw-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.015))] hover:-translate-y-[1px] hover:border-[color:var(--sw-border-strong)] hover:shadow-[var(--sw-shadow-card)]",
      )}
    >
      <div
        className={cn(
          "relative flex items-start gap-3 rounded-[21px] px-3 py-3",
          selected
            ? "bg-[linear-gradient(180deg,rgba(17,29,48,0.96),rgba(10,18,32,0.96))]"
            : "bg-[linear-gradient(180deg,rgba(14,23,39,0.94),rgba(10,18,32,0.9))]",
        )}
      >
        <span
          className={cn(
            "absolute bottom-4 left-0 top-4 w-px rounded-full bg-[linear-gradient(180deg,transparent,rgba(77,141,255,0.9),transparent)] transition-opacity",
            selected ? "opacity-100" : "opacity-0 group-hover:opacity-70",
          )}
        />

        <button
          type="button"
          onClick={onSelect}
          className="flex min-w-0 flex-1 items-start gap-3 text-left focus-visible:outline-none"
        >
          <div className="relative mt-0.5 h-12 w-12 shrink-0 overflow-hidden rounded-[16px] border border-[color:var(--sw-border)] bg-[radial-gradient(circle_at_30%_24%,rgba(77,141,255,0.18),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            {coverSticker ? (
              <StickerAssetPreview
                sticker={coverSticker}
                className="h-full w-full"
                imageClassName="h-full w-full object-contain p-2"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-[11px] font-medium text-[color:var(--sw-text-muted)]">
                No cover
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold tracking-[-0.02em] text-[color:var(--sw-text)]">
                  {pack.title}
                </div>
                <div className="mt-1 truncate text-[12px] text-[color:var(--sw-text-muted)]">
                  {subtitle}
                </div>
              </div>

              <span className="inline-flex min-h-7 items-center rounded-full border border-[color:var(--sw-border)] bg-white/[0.05] px-2.5 text-[11px] font-medium text-[color:var(--sw-text-secondary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                {pack.stickerCount}
              </span>
            </div>

            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              {pack.isPublished && !pack.isHidden && !pack.isArchived ? (
                <StatusBadge label="Live" tone="live" />
              ) : null}
              {!pack.isPublished ? <StatusBadge label="Draft" tone="neutral" /> : null}
              {pack.isDiscoverable && pack.isPublished ? (
                <StatusBadge label="Search" tone="accent" />
              ) : null}
              {pack.isHidden ? <StatusBadge label="Hidden" tone="warning" /> : null}
              {pack.isArchived ? <StatusBadge label="Archive" tone="danger" /> : null}
            </div>

            <div className="mt-2.5 flex items-center gap-2 text-[11px] text-[color:var(--sw-text-muted)]">
              <span className="uppercase tracking-[0.18em] text-[10px]">Updated</span>
              <span className="h-1 w-1 rounded-full bg-[rgba(185,198,218,0.44)]" />
              <span>{updatedLabel}</span>
            </div>
          </div>
        </button>

        <KebabMenu
          items={[
            {
              label: "Редактировать пак",
              onSelect: onEdit,
            },
            {
              label: "Поднять выше",
              onSelect: onMoveUp,
              disabled: !canMoveUp,
            },
            {
              label: "Опустить ниже",
              onSelect: onMoveDown,
              disabled: !canMoveDown,
            },
            {
              label: "Удалить пак",
              onSelect: onDelete,
              destructive: true,
            },
          ]}
          buttonClassName="opacity-100 md:opacity-70 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
        />
      </div>
    </div>
  );
}

const shortDateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "short",
});
