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
  return (
    <div
      className={cn(
        "group flex items-start gap-2 rounded-[18px] border px-3 py-2.5 transition-colors",
        selected
          ? "border-white/14 bg-white/[0.08]"
          : "border-white/8 bg-white/[0.03] hover:bg-white/[0.05]",
      )}
    >
      <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1 truncate text-sm font-medium text-white">
            {pack.title}
          </div>
          <span className="text-[11px] text-[var(--text-muted)]">{pack.stickerCount}</span>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
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
        buttonClassName="opacity-100 md:opacity-0 md:group-hover:opacity-100"
      />
    </div>
  );
}
