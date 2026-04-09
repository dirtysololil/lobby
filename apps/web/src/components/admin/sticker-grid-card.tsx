"use client";

import type { StickerAsset } from "@lobby/shared";
import { KebabMenu, StatusBadge } from "@/components/admin/sticker-admin-ui";
import { StickerAssetPreview } from "@/components/messages/sticker-asset-preview";

interface StickerGridCardProps {
  sticker: StickerAsset;
  isCover: boolean;
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
  canMoveUp,
  canMoveDown,
  onOpen,
  onMoveUp,
  onMoveDown,
  onMakeCover,
  onDelete,
}: StickerGridCardProps) {
  const keywordLine = sticker.keywords.slice(0, 3).join(" · ");

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex min-w-0 flex-col rounded-[20px] border border-white/8 bg-white/[0.03] p-2.5 text-left transition-colors hover:border-white/12 hover:bg-white/[0.05]"
    >
      <div className="relative overflow-hidden rounded-[16px] border border-white/6 bg-[radial-gradient(circle_at_top,rgba(106,168,248,0.12),transparent_56%),rgba(255,255,255,0.03)]">
        <StickerAssetPreview
          sticker={sticker}
          className="aspect-square rounded-[16px]"
          imageClassName="h-full w-full object-contain"
        />
      </div>

      <div className="mt-2.5 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-white">{sticker.title}</div>
          {keywordLine ? (
            <div className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">
              {keywordLine}
            </div>
          ) : null}
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
          />
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {sticker.isPublished && !sticker.isHidden && !sticker.isArchived ? (
          <StatusBadge label="Live" tone="live" />
        ) : null}
        {!sticker.isPublished ? <StatusBadge label="Draft" tone="neutral" /> : null}
        {sticker.isHidden ? <StatusBadge label="Hidden" tone="warning" /> : null}
        {sticker.isArchived ? <StatusBadge label="Archive" tone="danger" /> : null}
        {isCover ? <StatusBadge label="Cover" tone="accent" /> : null}
        {sticker.isAnimated ? <StatusBadge label="Gif" tone="neutral" /> : null}
      </div>
    </button>
  );
}
