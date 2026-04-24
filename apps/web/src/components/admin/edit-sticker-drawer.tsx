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
      title={sticker ? "Стикер" : "Стикер"}
      subtitle={sticker?.originalName ?? "Превью, поиск и быстрые действия."}
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
        <div className="grid gap-3">
          <div className="mx-auto w-full max-w-[260px] overflow-hidden rounded-[16px] border border-[var(--border)] bg-black">
            <StickerAssetPreview
              sticker={sticker}
              className="aspect-square rounded-[16px]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {sticker.isAnimated ? <StatusBadge label="GIF" tone="neutral" /> : null}
            {isCover ? <StatusBadge label="Обложка" tone="accent" /> : null}
          </div>

          <label className="grid gap-2">
            <span className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--text-muted)]">
              Название
            </span>
            <Input
              value={draft.title}
              onChange={(event) => onChange({ title: event.target.value })}
              className="h-11 rounded-[12px] border-[var(--border)] bg-black text-white hover:border-[var(--border-strong)]"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--text-muted)]">
              Ключевые слова
            </span>
            <Input
              value={draft.keywords}
              onChange={(event) => onChange({ keywords: event.target.value })}
              placeholder="мем, вау, реакция"
              className="h-11 rounded-[12px] border-[var(--border)] bg-black text-white hover:border-[var(--border-strong)]"
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
            className="h-10 justify-center rounded-[12px] border-white/8 bg-black hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)]"
          >
            {isCover ? "Это обложка набора" : "Сделать обложкой"}
          </Button>

          <Button
            type="button"
            size="sm"
            variant="destructive"
            onClick={onDelete}
            disabled={deleting}
            className="h-10 justify-center rounded-[12px] border-rose-400/25 bg-black text-rose-100 hover:border-rose-400/40 hover:bg-rose-500/10"
          >
            {deleting ? "Удаляем..." : "Удалить стикер"}
          </Button>
        </div>
      ) : null}
    </DrawerShell>
  );
}
