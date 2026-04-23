"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DrawerActions,
  DrawerShell,
  ToggleField,
} from "@/components/admin/sticker-admin-ui";

export interface StickerPackDraft {
  title: string;
  description: string;
  isPublished: boolean;
  isDiscoverable: boolean;
  isHidden: boolean;
  isArchived: boolean;
}

interface EditStickerPackDrawerProps {
  open: boolean;
  mode: "create" | "edit";
  draft: StickerPackDraft;
  saving: boolean;
  deleting: boolean;
  onClose: () => void;
  onChange: (patch: Partial<StickerPackDraft>) => void;
  onSave: () => void;
  onDelete?: () => void;
}

export function EditStickerPackDrawer({
  open,
  mode,
  draft,
  saving,
  deleting,
  onClose,
  onChange,
  onSave,
  onDelete,
}: EditStickerPackDrawerProps) {
  return (
    <DrawerShell
      open={open}
      title={mode === "create" ? "Новый набор" : "Редактирование набора"}
      subtitle="Слаг не показывается в интерфейсе и управляется системой."
      onClose={onClose}
      footer={
        <DrawerActions
          onClose={onClose}
          onSave={onSave}
          saveLabel={mode === "create" ? "Создать" : "Сохранить"}
          saving={saving}
          saveDisabled={!draft.title.trim()}
        />
      }
    >
      <div className="grid gap-4">
        <label className="grid gap-2">
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--text-muted)]">
            Название
          </span>
          <Input
            value={draft.title}
            onChange={(event) => onChange({ title: event.target.value })}
            placeholder="Например, Мемы"
            className="h-10 border-[var(--border)] bg-black text-white hover:border-[var(--border-strong)]"
          />
        </label>

        <label className="grid gap-2">
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--text-muted)]">
            Описание
          </span>
          <textarea
            value={draft.description}
            onChange={(event) => onChange({ description: event.target.value })}
            placeholder="Коротко, без лишнего шума."
            rows={4}
            className="min-h-[104px] rounded-[16px] border border-[var(--border)] bg-black px-3 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--border-strong)]"
          />
        </label>

        <div className="grid gap-2">
          <ToggleField
            label="Опубликован"
            checked={draft.isPublished}
            onChange={(isPublished) => onChange({ isPublished })}
          />
          <ToggleField
            label="Доступен для поиска"
            checked={draft.isDiscoverable}
            onChange={(isDiscoverable) => onChange({ isDiscoverable })}
            description="Показывать набор обычным пользователям в поиске и разрешить установку."
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

        {onDelete ? (
          <div className="pt-2">
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={onDelete}
              disabled={deleting}
              className="w-full justify-center"
            >
              {deleting ? "Удаляем..." : "Удалить набор"}
            </Button>
          </div>
        ) : null}
      </div>
    </DrawerShell>
  );
}
