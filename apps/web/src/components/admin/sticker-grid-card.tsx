"use client";

import type { StickerAsset } from "@lobby/shared";
import { KebabMenu, StatusBadge } from "@/components/admin/sticker-admin-ui";
import { StickerAssetPreview } from "@/components/messages/sticker-asset-preview";

interface StickerGridCardProps {
  sticker: StickerAsset;
  isCover: boolean;
  isSelected?: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onOpen: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onMakeCover: () => void;
  onDelete: () => void;
}

export function StickerGridCard({
  sticker,
  isCover,
  isSelected = false,
  canMoveUp,
  canMoveDown,
  onOpen,
  onMoveUp,
  onMoveDown,
  onMakeCover,
  onDelete,
}: StickerGridCardProps) {
  const keywordLine = sticker.keywords.slice(0, 3).join(" · ");
  const subtitle =
    sticker.originalName?.trim() ||
    (sticker.isAnimated ? "Animated sticker" : "Static sticker");
  const detailItems = [
    `${sticker.width}×${sticker.height}`,
    formatBytes(sticker.fileSize),
  ];

  return (
    <button
      type="button"
      onClick={onOpen}
      className={[
        "group relative flex min-w-0 flex-col rounded-[24px] border p-[1px] text-left transition-[transform,border-color,box-shadow,background] duration-200 focus-visible:outline-none",
        isSelected
          ? "border-[color:var(--sw-border-strong)] bg-[linear-gradient(135deg,rgba(77,141,255,0.28),rgba(34,197,139,0.12)_64%,transparent)] shadow-[var(--sw-shadow-glow)]"
          : "border-[color:var(--sw-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] hover:-translate-y-[2px] hover:border-[color:var(--sw-border-strong)] hover:shadow-[var(--sw-shadow-card)]",
      ].join(" ")}
    >
      <div
        className={[
          "relative flex h-full flex-col rounded-[23px] p-3",
          isSelected
            ? "bg-[linear-gradient(180deg,rgba(17,29,48,0.98),rgba(10,18,32,0.96))]"
            : "bg-[linear-gradient(180deg,rgba(14,23,39,0.96),rgba(10,18,32,0.94))]",
        ].join(" ")}
      >
        <div className="relative overflow-hidden rounded-[20px] border border-[color:var(--sw-border)] bg-[radial-gradient(circle_at_30%_18%,rgba(77,141,255,0.16),transparent_38%),radial-gradient(circle_at_78%_0%,rgba(34,197,139,0.12),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.015))] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {isSelected ? <StatusBadge label="Active" tone="accent" /> : null}
              {isCover ? <StatusBadge label="Cover" tone="accent" /> : null}
              {sticker.isAnimated ? <StatusBadge label="Gif" tone="neutral" /> : null}
            </div>

            <div
              className="shrink-0"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
            >
              <KebabMenu
                items={[
                  {
                    label: "Редактировать стикер",
                    onSelect: onOpen,
                  },
                  {
                    label: "Сделать обложкой",
                    onSelect: onMakeCover,
                    disabled: isCover,
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
                    label: "Удалить стикер",
                    onSelect: onDelete,
                    destructive: true,
                  },
                ]}
                buttonClassName="backdrop-blur-sm"
              />
            </div>
          </div>

          <StickerAssetPreview
            sticker={sticker}
            className="aspect-square rounded-[18px]"
            imageClassName="h-full w-full object-contain p-5"
          />
        </div>

        <div className="mt-3 flex flex-1 flex-col">
          <div className="min-w-0">
            <div className="truncate text-[14px] font-semibold tracking-[-0.02em] text-[color:var(--sw-text)]">
              {sticker.title}
            </div>
            <div className="mt-1 truncate text-[12px] text-[color:var(--sw-text-muted)]">
              {subtitle}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {detailItems.map((item, index) => (
              <div
                key={`${sticker.id}:${item}:${index}`}
                className="rounded-[16px] border border-[color:var(--sw-border-soft)] bg-white/[0.03] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
              >
                <div className="text-[10px] uppercase tracking-[0.16em] text-[color:var(--sw-text-muted)]">
                  {index === 0 ? "Canvas" : "Asset"}
                </div>
                <div className="mt-1 text-[12px] font-medium text-[color:var(--sw-text-secondary)]">
                  {item}
                </div>
              </div>
            ))}
          </div>

          {keywordLine ? (
            <div className="mt-3 truncate text-[11px] leading-5 text-[color:var(--sw-text-muted)]">
              {keywordLine}
            </div>
          ) : (
            <div className="mt-3 text-[11px] leading-5 text-[color:var(--sw-text-muted)]">
              No keywords yet
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {sticker.isPublished && !sticker.isHidden && !sticker.isArchived ? (
              <StatusBadge label="Live" tone="live" />
            ) : null}
            {!sticker.isPublished ? <StatusBadge label="Draft" tone="neutral" /> : null}
            {sticker.isHidden ? <StatusBadge label="Hidden" tone="warning" /> : null}
            {sticker.isArchived ? <StatusBadge label="Archive" tone="danger" /> : null}
          </div>
        </div>
      </div>
    </button>
  );
}

function formatBytes(value: number) {
  if (value >= 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (value >= 1024) {
    return `${Math.round(value / 1024)} KB`;
  }

  return `${value} B`;
}
