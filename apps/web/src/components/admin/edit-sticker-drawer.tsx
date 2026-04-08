"use client";

import type { StickerAsset } from "@lobby/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DrawerActions,
  DrawerShell,
  StatusBadge,
  ToggleField,
} from "@/components/admin/sticker-admin-ui";
import { StickerAssetPreview } from "@/components/messages/sticker-asset-preview";

export interface StickerDraft {
  title: string;
  keywords: string;
  isPublished: boolean;
  isHidden: boolean;
  isArchived: boolean;
}

interface EditStickerDrawerProps {
  open: boolean;
  sticker: StickerAsset | null;
  isCover: boolean;
  draft: StickerDraft;
  saving: boolean;
  deleting: boolean;
  onClose: () => void;
  onChange: (patch: Partial<StickerDraft>) => void;
  onSave: () => void;
  onDelete: () => void;
  onMakeCover: () => void;
}

export function EditStickerDrawer({
  open,
  sticker,
  isCover,
  draft,
  saving,
  deleting,
  onClose,
  onChange,
  onSave,
  onDelete,
  onMakeCover,
}: EditStickerDrawerProps) {
  return (
    <DrawerShell
      open={open}
      title={sticker ? "Редактирование стикера" : "Стикер"}
      subtitle={sticker?.originalName ?? "Живое превью и compact actions"}
      onClose={onClose}
      footer={
        <DrawerActions
          onClose={onClose}
          onSave={onSave}
          saving={saving}
          saveDisabled={!sticker || !draft.title.trim()}
        />
      }
    >
      {sticker ? (
        <div className="grid gap-4">
          <div className="overflow-hidden rounded-[20px] border border-white/8 bg-[radial-gradient(circle_at_top,rgba(106,168,248,0.12),transparent_52%),rgba(255,255,255,0.03)]">
            <StickerAssetPreview
              sticker={sticker}
              className="aspect-square rounded-[20px]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {sticker.isAnimated ? <StatusBadge label="Gif" tone="neutral" /> : null}
            {isCover ? <StatusBadge label="Cover" tone="accent" /> : null}
          </div>

          <label className="grid gap-2">
            <span className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--text-muted)]">
              Название
            </span>
            <Input
              value={draft.title}
              onChange={(event) => onChange({ title: event.target.value })}
              className="h-10 border-white/8 bg-white/[0.03] text-white"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--text-muted)]">
              Keywords
            </span>
            <Input
              value={draft.keywords}
              onChange={(event) => onChange({ keywords: event.target.value })}
              placeholder="meme, wow, reaction"
              className="h-10 border-white/8 bg-white/[0.03] text-white"
            />
          </label>

          <div className="grid gap-2">
            <ToggleField
              label="Опубликован"
              checked={draft.isPublished}
              onChange={(isPublished) => onChange({ isPublished })}
            />
            <ToggleField
              label="Скрыть"
              checked={draft.isHidden}
              onChange={(isHidden) => onChange({ isHidden })}
            />
            <ToggleField
              label="Архивировать"
              checked={draft.isArchived}
              onChange={(isArchived) => onChange({ isArchived })}
            />
          </div>

          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={onMakeCover}
            disabled={isCover}
            className="justify-center"
          >
            {isCover ? "Это обложка пака" : "Сделать обложкой"}
          </Button>

          <Button
            type="button"
            size="sm"
            variant="destructive"
            onClick={onDelete}
            disabled={deleting}
            className="justify-center"
          >
            {deleting ? "Удаляем..." : "Удалить стикер"}
          </Button>
        </div>
      ) : null}
    </DrawerShell>
  );
}
