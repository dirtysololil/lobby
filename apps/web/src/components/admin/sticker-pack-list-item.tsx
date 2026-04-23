"use client";

import type { StickerPack } from "@lobby/shared";
import { KebabMenu, StatusBadge } from "@/components/admin/sticker-admin-ui";
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
  const description = pack.description?.trim() ?? "";

  return (
    <div
      className={cn(
        "group relative flex items-start gap-2 rounded-[16px] border bg-black px-3 py-3 transition-colors",
        selected
          ? "border-[var(--border-strong)] bg-[var(--bg-active)]"
          : "border-[var(--border-soft)] hover:border-[var(--border)] hover:bg-[var(--bg-hover)]",
      )}
    >
      {selected ? (
        <span className="absolute inset-y-3 left-0 w-[2px] rounded-r-full bg-[#0070F3]" />
      ) : null}

      <button type="button" onClick={onSelect} className="min-w-0 flex-1 pl-1 text-left">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1 truncate text-sm font-medium text-white">
            {pack.title}
          </div>
          <span className="text-[11px] text-[var(--text-muted)]">
            {pack.stickerCount} шт.
          </span>
        </div>

        {description ? (
          <div className="mt-1 line-clamp-2 text-[12px] leading-5 text-[var(--text-dim)]">
            {description}
          </div>
        ) : null}

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {pack.isPublished && !pack.isHidden && !pack.isArchived ? (
            <StatusBadge label="Активен" tone="live" />
          ) : null}
          {!pack.isPublished ? <StatusBadge label="Черновик" tone="neutral" /> : null}
          {pack.isDiscoverable && pack.isPublished ? (
            <StatusBadge label="Поиск" tone="accent" />
          ) : null}
          {pack.isHidden ? <StatusBadge label="Скрыт" tone="warning" /> : null}
          {pack.isArchived ? <StatusBadge label="Архив" tone="danger" /> : null}
        </div>
      </button>

      <KebabMenu
        items={[
          {
            label: "Редактировать набор",
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
            label: "Удалить набор",
            onSelect: onDelete,
            destructive: true,
          },
        ]}
        buttonClassName="opacity-100 md:opacity-0 md:group-hover:opacity-100"
      />
    </div>
  );
}
