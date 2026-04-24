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
    <div className="group flex min-w-0 flex-col rounded-[16px] border border-[var(--border-soft)] bg-black p-2 text-left transition-colors hover:border-[var(--border)] hover:bg-[var(--bg-hover)]">
      <button type="button" onClick={onOpen} className="min-w-0 text-left">
        <div className="relative overflow-hidden rounded-[12px] border border-[var(--border-soft)] bg-black">
          <StickerAssetPreview
            sticker={sticker}
            className="aspect-square rounded-[12px]"
            imageClassName="h-full w-full object-contain"
          />
        </div>
      </button>

      <div className="mt-2 flex items-start gap-2">
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
          <span className="block truncate text-sm font-medium text-white">
            {sticker.title}
          </span>
          <span className="mt-0.5 block min-h-[16px] truncate text-[11px] text-[var(--text-muted)]">
            {keywordLine || sticker.originalName || "Без ключевых слов"}
          </span>
        </button>

        <div className="shrink-0">
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

      <div className="mt-2 flex min-h-[22px] flex-wrap items-center gap-1">
        {sticker.isPublished && !sticker.isHidden && !sticker.isArchived ? (
          <StatusBadge label="Активен" tone="live" />
        ) : null}
        {!sticker.isPublished ? <StatusBadge label="Черновик" tone="neutral" /> : null}
        {sticker.isHidden ? <StatusBadge label="Скрыт" tone="warning" /> : null}
        {sticker.isArchived ? <StatusBadge label="Архив" tone="danger" /> : null}
        {isCover ? <StatusBadge label="Обложка" tone="accent" /> : null}
        {sticker.isAnimated ? <StatusBadge label="GIF" tone="neutral" /> : null}
      </div>
    </div>
  );
}
