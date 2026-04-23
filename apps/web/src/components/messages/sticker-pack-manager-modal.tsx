"use client";

import type { StickerCatalog } from "@lobby/shared";
import {
  stickerCatalogResponseSchema,
  stickerPackResponseSchema,
  stickerResponseSchema,
} from "@lobby/shared";
import {
  ArrowDown,
  ArrowUp,
  FolderPlus,
  ImagePlus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { apiClientFetch } from "@/lib/api-client";
import { reorderItems } from "@/lib/stickers";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StickerAssetPreview } from "./sticker-asset-preview";

interface StickerPackManagerModalProps {
  open: boolean;
  catalog: StickerCatalog | null;
  onClose: () => void;
  onCatalogChange: (catalog: StickerCatalog) => void;
  onRefreshCatalog: () => Promise<StickerCatalog | null>;
}

export function StickerPackManagerModal({
  open,
  catalog,
  onClose,
  onCatalogChange,
  onRefreshCatalog,
}: StickerPackManagerModalProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
  const [newPackTitle, setNewPackTitle] = useState("");
  const [editingTitle, setEditingTitle] = useState("");
  const [stickerTitle, setStickerTitle] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const visibleFrame = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setVisible(true));
      });

      return () => window.cancelAnimationFrame(visibleFrame);
    }

    const hideFrame = window.requestAnimationFrame(() => setVisible(false));
    const timer = window.setTimeout(() => setMounted(false), 180);

    return () => {
      window.cancelAnimationFrame(hideFrame);
      window.clearTimeout(timer);
    };
  }, [open]);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mounted, onClose]);

  useEffect(() => {
    const firstPackId = catalog?.packs[0]?.id ?? null;

    if (!selectedPackId || !catalog?.packs.some((pack) => pack.id === selectedPackId)) {
      setSelectedPackId(firstPackId);
    }
  }, [catalog, selectedPackId]);

  const selectedPack = useMemo(
    () => catalog?.packs.find((pack) => pack.id === selectedPackId) ?? null,
    [catalog, selectedPackId],
  );

  useEffect(() => {
    setEditingTitle(selectedPack?.title ?? "");
  }, [selectedPack?.id, selectedPack?.title]);

  if (!mounted) {
    return null;
  }

  const portalTarget = typeof document !== "undefined" ? document.body : null;

  if (!portalTarget) {
    return null;
  }

  async function refreshCatalog(selectedId?: string | null) {
    const nextCatalog = await onRefreshCatalog();

    if (nextCatalog) {
      onCatalogChange(nextCatalog);
      const fallbackPackId = nextCatalog.packs[0]?.id ?? null;
      setSelectedPackId(selectedId ?? fallbackPackId);
    } else {
      setSelectedPackId(null);
    }
  }

  async function handleCreatePack() {
    if (!newPackTitle.trim()) {
      setErrorMessage("Введите название набора.");
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);

    try {
      const payload = await apiClientFetch("/v1/stickers/packs", {
        method: "POST",
        body: JSON.stringify({
          title: newPackTitle.trim(),
        }),
      });
      const pack = stickerPackResponseSchema.parse(payload).pack;
      await refreshCatalog(pack.id);
      setNewPackTitle("");
      setStatusMessage("Набор создан.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось создать набор.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleRenamePack() {
    if (!selectedPack) {
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);

    try {
      await apiClientFetch(`/v1/stickers/packs/${selectedPack.id}`, {
        method: "PATCH",
        body: JSON.stringify({ title: editingTitle }),
      });
      await refreshCatalog(selectedPack.id);
      setStatusMessage("Название сохранено.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось переименовать набор.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDeletePack() {
    if (!selectedPack) {
      return;
    }

    if (!window.confirm(`Удалить набор «${selectedPack.title}»?`)) {
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);

    try {
      await apiClientFetch(`/v1/stickers/packs/${selectedPack.id}`, {
        method: "DELETE",
      });
      await refreshCatalog(null);
      setStatusMessage("Набор удалён.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось удалить набор.");
    } finally {
      setIsBusy(false);
    }
  }

  async function movePack(packId: string, direction: -1 | 1) {
    if (!catalog) {
      return;
    }

    const currentIndex = catalog.packs.findIndex((pack) => pack.id === packId);
    const nextIndex = currentIndex + direction;

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= catalog.packs.length) {
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);

    try {
      const ordered = reorderItems(catalog.packs, currentIndex, nextIndex);
      await apiClientFetch("/v1/stickers/packs/reorder", {
        method: "POST",
        body: JSON.stringify({ packIds: ordered.map((item) => item.id) }),
      });
      await refreshCatalog(packId);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось изменить порядок наборов.");
    } finally {
      setIsBusy(false);
    }
  }

  async function moveSticker(stickerId: string, direction: -1 | 1) {
    if (!selectedPack) {
      return;
    }

    const currentIndex = selectedPack.stickers.findIndex((sticker) => sticker.id === stickerId);
    const nextIndex = currentIndex + direction;

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= selectedPack.stickers.length) {
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);

    try {
      const ordered = reorderItems(selectedPack.stickers, currentIndex, nextIndex);
      await apiClientFetch(`/v1/stickers/packs/${selectedPack.id}/stickers/reorder`, {
        method: "POST",
        body: JSON.stringify({ stickerIds: ordered.map((item) => item.id) }),
      });
      await refreshCatalog(selectedPack.id);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось изменить порядок стикеров.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDeleteSticker(stickerId: string) {
    if (!selectedPack) {
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);

    try {
      await apiClientFetch(`/v1/stickers/packs/${selectedPack.id}/stickers/${stickerId}`, {
        method: "DELETE",
      });
      await refreshCatalog(selectedPack.id);
      setStatusMessage("Стикер удалён.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось удалить стикер.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleUploadSticker(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!selectedPack || !file) {
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      if (stickerTitle.trim()) {
        formData.append("title", stickerTitle.trim());
      }

      const payload = await apiClientFetch(`/v1/stickers/packs/${selectedPack.id}/stickers`, {
        method: "POST",
        body: formData,
      });
      stickerResponseSchema.parse(payload);
      await refreshCatalog(selectedPack.id);
      setStickerTitle("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setStatusMessage("Стикер загружен.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось загрузить стикер.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleReload() {
    setIsBusy(true);
    setErrorMessage(null);

    try {
      const payload = await apiClientFetch("/v1/stickers/me");
      const nextCatalog = stickerCatalogResponseSchema.parse(payload).catalog;
      onCatalogChange(nextCatalog);
      setSelectedPackId((current) => current ?? nextCatalog.packs[0]?.id ?? null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось обновить список наборов.");
    } finally {
      setIsBusy(false);
    }
  }

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[95] flex items-center justify-center bg-black/88 p-4 transition-opacity duration-150",
        visible ? "opacity-100" : "opacity-0",
      )}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      role="presentation"
    >
      <div
        className={cn(
          "relative flex h-[min(84vh,760px)] w-full max-w-[min(96vw,1080px)] flex-col overflow-hidden rounded-[28px] border border-white/10 bg-black shadow-[0_36px_120px_rgba(0,0,0,0.6)] transition duration-200",
          visible ? "translate-y-0 scale-100" : "translate-y-2 scale-[0.97]",
        )}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/25 text-[var(--text-soft)] transition-colors hover:border-white/16 hover:bg-black/40 hover:text-white"
          aria-label="Закрыть управление стикерами"
        >
          <X className="h-4.5 w-4.5" />
        </button>

        <div className="border-b border-white/6 px-5 py-4 pr-14">
          <p className="text-base font-semibold tracking-tight text-white">Стикеры</p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Управляйте своими наборами и порядком стикеров без лишней админки.
          </p>
        </div>

        {errorMessage ? (
          <div className="border-b border-rose-400/20 bg-rose-400/10 px-5 py-2 text-sm text-rose-200">
            {errorMessage}
          </div>
        ) : null}

        {statusMessage ? (
          <div className="border-b border-emerald-400/15 bg-emerald-400/10 px-5 py-2 text-sm text-emerald-100">
            {statusMessage}
          </div>
        ) : null}

        <div className="grid min-h-0 flex-1 gap-0 md:grid-cols-[300px_1fr]">
          <aside className="flex min-h-0 flex-col border-b border-white/6 md:border-b-0 md:border-r">
            <div className="grid gap-2 border-b border-white/6 p-4">
              <label className="grid gap-2">
                <span className="text-xs uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  Новый набор
                </span>
                <Input
                  value={newPackTitle}
                  onChange={(event) => setNewPackTitle(event.target.value)}
                  placeholder="Например, Мемы"
                  className="h-10"
                />
              </label>
              <Button
                type="button"
                onClick={() => void handleCreatePack()}
                disabled={isBusy}
                className="h-10 rounded-[14px]"
              >
                <FolderPlus size={16} strokeWidth={1.5} />
                Создать набор
              </Button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {!catalog || catalog.packs.length === 0 ? (
                <div className="rounded-[18px] border border-dashed border-white/8 bg-white/[0.02] px-4 py-5 text-sm text-[var(--text-muted)]">
                  Наборов пока нет.
                </div>
              ) : (
                <div className="grid gap-2">
                  {catalog.packs.map((pack, index) => (
                    <div
                      key={pack.id}
                      className={cn(
                        "rounded-[18px] border p-3 transition-colors",
                        selectedPackId === pack.id
                          ? "border-white/12 bg-white/[0.08]"
                          : "border-white/6 bg-white/[0.03]",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPackId(pack.id);
                          setStatusMessage(null);
                          setErrorMessage(null);
                        }}
                        className="w-full text-left"
                      >
                        <div className="truncate text-sm font-medium text-white">{pack.title}</div>
                        <div className="mt-1 text-xs text-[var(--text-muted)]">
                          {pack.stickers.length} стикеров
                        </div>
                      </button>

                      <div className="mt-3 flex gap-1">
                        <IconActionButton
                          label="Выше"
                          disabled={isBusy || index === 0}
                          onClick={() => void movePack(pack.id, -1)}
                          icon={<ArrowUp size={14} strokeWidth={1.5} />}
                        />
                        <IconActionButton
                          label="Ниже"
                          disabled={isBusy || index === catalog.packs.length - 1}
                          onClick={() => void movePack(pack.id, 1)}
                          icon={<ArrowDown size={14} strokeWidth={1.5} />}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>

          <section className="flex min-h-0 flex-col">
            {selectedPack ? (
              <>
                <div className="grid gap-4 border-b border-white/6 p-4 lg:grid-cols-[1fr_auto] lg:items-end">
                  <div className="grid gap-3">
                    <label className="grid gap-2">
                      <span className="text-xs uppercase tracking-[0.12em] text-[var(--text-muted)]">
                        Название набора
                      </span>
                      <Input
                        value={editingTitle}
                        onChange={(event) => setEditingTitle(event.target.value)}
                        placeholder="Название набора"
                        className="h-10"
                      />
                    </label>

                    <div className="grid gap-2 lg:grid-cols-[1fr_auto]">
                      <Input
                        value={stickerTitle}
                        onChange={(event) => setStickerTitle(event.target.value)}
                        placeholder="Название следующего стикера"
                        className="h-10"
                      />
                      <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-[14px] border border-white/8 bg-black px-3 text-sm text-white transition-colors hover:bg-[var(--bg-hover)]">
                        <ImagePlus size={16} strokeWidth={1.5} />
                        Загрузить стикер
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/png,image/webp,image/gif"
                          className="hidden"
                          onChange={(event) => void handleUploadSticker(event)}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      onClick={() => void handleRenamePack()}
                      disabled={isBusy}
                      className="h-10 rounded-[14px] px-3"
                    >
                      <Save size={16} strokeWidth={1.5} />
                      Сохранить
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => void handleDeletePack()}
                      disabled={isBusy}
                      className="h-10 rounded-[14px] px-3 text-rose-100 hover:bg-rose-500/10 hover:text-rose-100"
                    >
                      <Trash2 size={16} strokeWidth={1.5} />
                      Удалить
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => void handleReload()}
                      disabled={isBusy}
                      className="h-10 rounded-[14px] px-3"
                    >
                      Обновить
                    </Button>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                  {selectedPack.stickers.length === 0 ? (
                    <div className="rounded-[22px] border border-dashed border-white/8 bg-white/[0.02] px-5 py-8 text-center">
                      <p className="text-sm font-medium text-white">Пак пока пустой</p>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        Загрузите первый стикер в PNG, GIF или WEBP.
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {selectedPack.stickers.map((sticker, index) => (
                        <div
                          key={sticker.id}
                          className="rounded-[20px] border border-white/8 bg-black p-3"
                        >
                          <StickerAssetPreview
                            sticker={sticker}
                            className="aspect-square rounded-[16px] bg-black"
                          />
                          <div className="mt-3 flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-white">
                                {sticker.title}
                              </div>
                              <div className="mt-1 text-xs text-[var(--text-muted)]">
                                {sticker.isAnimated ? "Анимированный" : "Статичный"}
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <IconActionButton
                                label="Выше"
                                disabled={isBusy || index === 0}
                                onClick={() => void moveSticker(sticker.id, -1)}
                                icon={<ArrowUp size={14} strokeWidth={1.5} />}
                              />
                              <IconActionButton
                                label="Ниже"
                                disabled={isBusy || index === selectedPack.stickers.length - 1}
                                onClick={() => void moveSticker(sticker.id, 1)}
                                icon={<ArrowDown size={14} strokeWidth={1.5} />}
                              />
                              <IconActionButton
                                label="Удалить"
                                disabled={isBusy}
                                onClick={() => void handleDeleteSticker(sticker.id)}
                                icon={<Trash2 size={14} strokeWidth={1.5} />}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="grid h-full place-items-center p-8 text-center">
                <div>
                  <p className="text-sm font-medium text-white">Выберите набор</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    Слева можно создать новый пак или открыть существующий.
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>,
    portalTarget,
  );
}

function IconActionButton({
  icon,
  label,
  disabled,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/8 bg-white/[0.03] text-[var(--text-muted)] transition-colors hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
      aria-label={label}
      title={label}
    >
      {icon}
    </button>
  );
}
