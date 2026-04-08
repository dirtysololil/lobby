"use client";

import type { PublicUser, StickerAsset, StickerPack } from "@lobby/shared";
import {
  adminMediaLibraryResponseSchema,
  stickerPackResponseSchema,
  stickerResponseSchema,
} from "@lobby/shared";
import {
  Archive,
  Eye,
  EyeOff,
  FolderPlus,
  GripVertical,
  Search,
  Sticker,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { StickerEditorModal, type StickerEditorDraft } from "@/components/admin/sticker-editor-modal";
import { StickerAssetPreview } from "@/components/messages/sticker-asset-preview";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { apiClientFetch } from "@/lib/api-client";
import { reorderItems } from "@/lib/stickers";
import { cn } from "@/lib/utils";

interface StickerPacksAdminPanelProps {
  viewer: PublicUser;
  initialPacks: StickerPack[];
}

export function StickerPacksAdminPanel({
  viewer,
  initialPacks,
}: StickerPacksAdminPanelProps) {
  const [packs, setPacks] = useState(initialPacks);
  const [selectedPackId, setSelectedPackId] = useState(initialPacks[0]?.id ?? null);
  const [search, setSearch] = useState("");
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newPackTitle, setNewPackTitle] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [draggedPackId, setDraggedPackId] = useState<string | null>(null);
  const [draggedStickerId, setDraggedStickerId] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    title: "",
    description: "",
  });

  useEffect(() => {
    setPacks(initialPacks);
  }, [initialPacks]);

  useEffect(() => {
    const selected =
      packs.find((pack) => pack.id === selectedPackId) ?? packs[0] ?? null;
    setSelectedPackId(selected?.id ?? null);
    setDraft({
      title: selected?.title ?? "",
      description: selected?.description ?? "",
    });
  }, [packs, selectedPackId]);

  const selectedPack = useMemo(
    () => packs.find((pack) => pack.id === selectedPackId) ?? null,
    [packs, selectedPackId],
  );
  const filteredPacks = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return packs;
    }

    return packs.filter((pack) =>
      [
        pack.title,
        pack.slug,
        pack.description ?? "",
        ...pack.stickers.flatMap((sticker) => [
          sticker.title,
          sticker.originalName ?? "",
          ...sticker.keywords,
        ]),
      ].some((candidate) => candidate.toLowerCase().includes(query)),
    );
  }, [packs, search]);
  const visibleStickers = useMemo(() => {
    if (!selectedPack) {
      return [] as StickerAsset[];
    }

    const query = search.trim().toLowerCase();

    if (!query) {
      return selectedPack.stickers;
    }

    return selectedPack.stickers.filter((sticker) =>
      [
        sticker.title,
        sticker.originalName ?? "",
        ...sticker.keywords,
      ].some((candidate) => candidate.toLowerCase().includes(query)),
    );
  }, [search, selectedPack]);

  async function refreshPacks(nextSelectedPackId?: string | null) {
    const payload = await apiClientFetch("/v1/admin/media/library");
    const library = adminMediaLibraryResponseSchema.parse(payload).library;
    setPacks(library.stickerPacks);
    setSelectedPackId(
      nextSelectedPackId ??
        library.stickerPacks.find((pack) => pack.id === selectedPackId)?.id ??
        library.stickerPacks[0]?.id ??
        null,
    );
  }

  async function runAction(key: string, action: () => Promise<void>) {
    setPendingKey(key);
    setError(null);

    try {
      await action();
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Не удалось выполнить действие.",
      );
    } finally {
      setPendingKey(null);
    }
  }

  async function handleCreatePack() {
    if (!newPackTitle.trim()) {
      setError("Укажите название пака.");
      return;
    }

    await runAction("pack:create", async () => {
      const payload = await apiClientFetch("/v1/stickers/packs", {
        method: "POST",
        body: JSON.stringify({
          title: newPackTitle.trim(),
        }),
      });
      const pack = stickerPackResponseSchema.parse(payload).pack;
      await refreshPacks(pack.id);
      setNewPackTitle("");
      setStatus("Пак создан.");
    });
  }

  async function handleSavePack() {
    if (!selectedPack) {
      return;
    }

    await runAction(`pack:save:${selectedPack.id}`, async () => {
      await apiClientFetch(`/v1/stickers/packs/${selectedPack.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: draft.title.trim(),
          description: draft.description.trim() || null,
          coverStickerId: selectedPack.coverStickerId ?? null,
        }),
      });
      await refreshPacks(selectedPack.id);
      setStatus("Пак обновлён.");
    });
  }

  async function handleSavePackCover(pack: StickerPack, stickerId: string) {
    await runAction(`pack:cover:${pack.id}`, async () => {
      await apiClientFetch(`/v1/stickers/packs/${pack.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          coverStickerId: stickerId,
        }),
      });
      await refreshPacks(pack.id);
      setStatus("Обложка пака обновлена.");
    });
  }

  async function setPackPublished(pack: StickerPack, published: boolean) {
    await runAction(`pack:publish:${pack.id}`, async () => {
      await apiClientFetch(`/v1/stickers/packs/${pack.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          published,
          archived: false,
        }),
      });
      await refreshPacks(pack.id);
      setStatus(published ? "Пак опубликован." : "Пак скрыт.");
    });
  }

  async function setPackArchived(pack: StickerPack, archived: boolean) {
    await runAction(`pack:archive:${pack.id}`, async () => {
      await apiClientFetch(`/v1/stickers/packs/${pack.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          archived,
        }),
      });
      await refreshPacks(pack.id);
      setStatus(archived ? "Пак архивирован." : "Пак возвращён из архива.");
    });
  }

  async function deletePack(pack: StickerPack) {
    if (!window.confirm(`Удалить пак «${pack.title}»?`)) {
      return;
    }

    await runAction(`pack:delete:${pack.id}`, async () => {
      await apiClientFetch(`/v1/stickers/packs/${pack.id}`, {
        method: "DELETE",
      });
      await refreshPacks(null);
      setStatus("Пак удалён.");
    });
  }

  async function reorderPacks(nextPacks: StickerPack[]) {
    setPacks(nextPacks);
    await runAction("pack:reorder", async () => {
      await apiClientFetch("/v1/stickers/packs/reorder", {
        method: "POST",
        body: JSON.stringify({
          packIds: nextPacks.map((pack) => pack.id),
        }),
      });
      await refreshPacks(selectedPackId);
      setStatus("Порядок паков обновлён.");
    });
  }

  async function reorderStickers(nextStickers: StickerAsset[]) {
    if (!selectedPack) {
      return;
    }

    setPacks((current) =>
      current.map((pack) =>
        pack.id === selectedPack.id
          ? {
              ...pack,
              stickers: nextStickers,
            }
          : pack,
      ),
    );

    await runAction(`sticker:reorder:${selectedPack.id}`, async () => {
      await apiClientFetch(`/v1/stickers/packs/${selectedPack.id}/stickers/reorder`, {
        method: "POST",
        body: JSON.stringify({
          stickerIds: nextStickers.map((sticker) => sticker.id),
        }),
      });
      await refreshPacks(selectedPack.id);
      setStatus("Порядок стикеров обновлён.");
    });
  }

  async function uploadSticker(draftValue: StickerEditorDraft) {
    if (!selectedPack) {
      return;
    }

    await runAction(`sticker:upload:${selectedPack.id}`, async () => {
      const formData = new FormData();
      formData.append("file", draftValue.file);
      formData.append("title", draftValue.title.trim());
      formData.append("keywords", draftValue.keywords.join(","));
      formData.append("crop", JSON.stringify(draftValue.crop));
      formData.append("published", String(draftValue.published));
      const payload = await apiClientFetch(`/v1/stickers/packs/${selectedPack.id}/stickers`, {
        method: "POST",
        body: formData,
      });
      stickerResponseSchema.parse(payload);
      await refreshPacks(selectedPack.id);
      setEditorOpen(false);
      setStatus("Стикер сохранён.");
    });
  }

  async function updateSticker(
    sticker: StickerAsset,
    patch: Record<string, unknown>,
    successMessage: string,
  ) {
    if (!selectedPack) {
      return;
    }

    await runAction(`sticker:update:${sticker.id}`, async () => {
      await apiClientFetch(`/v1/stickers/packs/${selectedPack.id}/stickers/${sticker.id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      await refreshPacks(selectedPack.id);
      setStatus(successMessage);
    });
  }

  async function deleteSticker(sticker: StickerAsset) {
    if (!selectedPack) {
      return;
    }

    if (!window.confirm(`Удалить стикер «${sticker.title}»?`)) {
      return;
    }

    await runAction(`sticker:delete:${sticker.id}`, async () => {
      await apiClientFetch(`/v1/stickers/packs/${selectedPack.id}/stickers/${sticker.id}`, {
        method: "DELETE",
      });
      await refreshPacks(selectedPack.id);
      setStatus("Стикер удалён.");
    });
  }

  return (
    <>
      <div className="grid gap-4">
        <section className="premium-panel rounded-[26px] p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="eyebrow-pill">
                  <Sticker size={18} strokeWidth={1.5} />
                  Sticker packs
                </span>
                <span className="status-pill">{viewer.role}</span>
              </div>
              <h1 className="mt-3 text-xl font-semibold tracking-tight text-white">
                Стикер паки
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-dim)]">
                Системные паки, публикация, архив, сортировка и живой редактор стикеров.
              </p>
            </div>

            <label className="flex items-center gap-2 rounded-[16px] border border-white/8 bg-white/[0.03] px-3 text-[var(--text-muted)]">
              <Search size={16} strokeWidth={1.5} className="shrink-0" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Поиск по пакам и стикерам"
                className="h-10 border-0 bg-transparent px-0 text-sm text-white"
              />
            </label>
          </div>

          {error ? <p className="mt-4 text-sm text-rose-200">{error}</p> : null}
          {status ? <p className="mt-2 text-sm text-emerald-200">{status}</p> : null}
        </section>

        <section className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="premium-panel rounded-[24px] p-5">
            <div className="grid gap-3 rounded-[20px] border border-white/8 bg-white/[0.03] p-4">
              <Input
                value={newPackTitle}
                onChange={(event) => setNewPackTitle(event.target.value)}
                placeholder="Название пака"
                className="h-11 border-white/8 bg-white/[0.03] text-white"
              />
              <p className="rounded-[16px] border border-dashed border-white/8 bg-white/[0.02] px-3 py-2 text-xs text-[var(--text-muted)]">
                Slug сгенерируется автоматически из названия.
              </p>
              <Button
                type="button"
                onClick={() => void handleCreatePack()}
                disabled={pendingKey === "pack:create"}
              >
                <FolderPlus size={16} strokeWidth={1.5} />
                Создать пак
              </Button>
            </div>

            <div className="mt-4 grid gap-2">
              {filteredPacks.length === 0 ? (
                <EmptyState
                  title="Паки не найдены"
                  description="Создайте первый пак или измените поисковый запрос."
                />
              ) : (
                filteredPacks.map((pack, index) => (
                  <button
                    key={pack.id}
                    type="button"
                    draggable
                    onDragStart={() => setDraggedPackId(pack.id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => {
                      if (!draggedPackId || draggedPackId === pack.id) {
                        return;
                      }

                      const fromIndex = packs.findIndex((item) => item.id === draggedPackId);
                      const toIndex = packs.findIndex((item) => item.id === pack.id);

                      if (fromIndex >= 0 && toIndex >= 0) {
                        void reorderPacks(reorderItems(packs, fromIndex, toIndex));
                      }

                      setDraggedPackId(null);
                    }}
                    onDragEnd={() => setDraggedPackId(null)}
                    onClick={() => setSelectedPackId(pack.id)}
                    className={cn(
                      "rounded-[18px] border px-4 py-3 text-left transition-colors",
                      selectedPackId === pack.id
                        ? "border-white/14 bg-white/[0.08]"
                        : "border-white/8 bg-white/[0.03] hover:bg-white/[0.05]",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-white">
                          {pack.title}
                        </div>
                        <div className="mt-1 truncate text-xs text-[var(--text-dim)]">
                          {pack.stickers.length} стикеров
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <GripVertical size={15} strokeWidth={1.5} className="text-[var(--text-muted)]" />
                        <span className="text-[11px] text-[var(--text-muted)]">
                          #{index + 1}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-[11px]">
                      <LifecyclePill pack={pack} />
                    </div>
                  </button>
                ))
              )}
            </div>
          </aside>

          <section className="premium-panel rounded-[24px] p-5">
            {!selectedPack ? (
              <EmptyState
                title="Выберите пак"
                description="Слева видны все текущие системные sticker packs."
              />
            ) : (
              <div className="grid gap-5">
                <div className="grid gap-4 rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
                  <Input
                    value={draft.title}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, title: event.target.value }))
                    }
                    placeholder="Название пака"
                    className="h-11 border-white/8 bg-white/[0.03] text-white"
                  />
                  <textarea
                    value={draft.description}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    placeholder="Описание пака"
                    className="min-h-[88px] rounded-[18px] border border-white/8 bg-white/[0.03] px-3 py-3 text-sm text-white outline-none placeholder:text-[var(--text-muted)]"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      onClick={() => void handleSavePack()}
                      disabled={pendingKey === `pack:save:${selectedPack.id}`}
                    >
                      Сохранить
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => void setPackPublished(selectedPack, !selectedPack.publishedAt)}
                    >
                      {selectedPack.publishedAt ? (
                        <>
                          <EyeOff size={16} strokeWidth={1.5} />
                          Скрыть
                        </>
                      ) : (
                        <>
                          <Eye size={16} strokeWidth={1.5} />
                          Опубликовать
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => void setPackArchived(selectedPack, !selectedPack.archivedAt)}
                    >
                      <Archive size={16} strokeWidth={1.5} />
                      {selectedPack.archivedAt ? "Разархивировать" : "Архивировать"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-rose-100 hover:text-rose-50"
                      onClick={() => void deletePack(selectedPack)}
                    >
                      <Trash2 size={16} strokeWidth={1.5} />
                      Удалить
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-white">Стикеры</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      Drag-and-drop порядок, быстрый publish и живой preview.
                    </p>
                  </div>
                  <Button type="button" onClick={() => setEditorOpen(true)}>
                    Добавить стикер
                  </Button>
                </div>

                {visibleStickers.length === 0 ? (
                  <EmptyState
                    title="Стикеров пока нет"
                    description="Откройте редактор, загрузите исходник и сохраните первый стикер."
                  />
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {visibleStickers.map((sticker) => (
                      <div
                        key={sticker.id}
                        draggable
                        onDragStart={() => setDraggedStickerId(sticker.id)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => {
                          if (!selectedPack || !draggedStickerId || draggedStickerId === sticker.id) {
                            return;
                          }

                          const fromIndex = selectedPack.stickers.findIndex(
                            (item) => item.id === draggedStickerId,
                          );
                          const toIndex = selectedPack.stickers.findIndex(
                            (item) => item.id === sticker.id,
                          );

                          if (fromIndex >= 0 && toIndex >= 0) {
                            void reorderStickers(
                              reorderItems(selectedPack.stickers, fromIndex, toIndex),
                            );
                          }

                          setDraggedStickerId(null);
                        }}
                        onDragEnd={() => setDraggedStickerId(null)}
                        className="rounded-[20px] border border-white/8 bg-white/[0.03] p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <StickerAssetPreview
                            sticker={sticker}
                            className="aspect-square rounded-[18px] bg-[radial-gradient(circle_at_top,rgba(106,168,248,0.12),transparent_55%),rgba(255,255,255,0.03)]"
                          />
                        </div>
                        <div className="mt-3 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-white">
                              {sticker.title}
                            </p>
                            <p className="mt-1 truncate text-xs text-[var(--text-dim)]">
                              {sticker.keywords.length > 0
                                ? sticker.keywords.join(", ")
                                : "Без keyword-ов"}
                            </p>
                          </div>
                          <GripVertical size={15} strokeWidth={1.5} className="shrink-0 text-[var(--text-muted)]" />
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <StickerLifecyclePill sticker={sticker} />
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              void handleSavePackCover(selectedPack, sticker.id)
                            }
                          >
                            Обложка
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              void updateSticker(
                                sticker,
                                { published: !sticker.publishedAt, archived: false },
                                sticker.publishedAt
                                  ? "Стикер скрыт."
                                  : "Стикер опубликован.",
                              )
                            }
                          >
                            {sticker.publishedAt ? "Скрыть" : "Паблиш"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              void updateSticker(
                                sticker,
                                { archived: !sticker.archivedAt },
                                sticker.archivedAt
                                  ? "Стикер возвращён из архива."
                                  : "Стикер архивирован.",
                              )
                            }
                          >
                            {sticker.archivedAt ? "Вернуть" : "Архив"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="text-rose-100 hover:text-rose-50"
                            onClick={() => void deleteSticker(sticker)}
                          >
                            Удалить
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        </section>
      </div>

      <StickerEditorModal
        open={editorOpen}
        pending={pendingKey === `sticker:upload:${selectedPack?.id ?? "none"}`}
        error={error}
        onClose={() => {
          if (pendingKey?.startsWith("sticker:upload:")) {
            return;
          }
          setEditorOpen(false);
        }}
        onSubmit={uploadSticker}
      />
    </>
  );
}

function LifecyclePill({ pack }: { pack: StickerPack }) {
  if (pack.archivedAt) {
    return (
      <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-amber-200">
        Архив
      </span>
    );
  }

  if (pack.publishedAt) {
    return (
      <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-emerald-200">
        Published
      </span>
    );
  }

  return (
    <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
      Draft
    </span>
  );
}

function StickerLifecyclePill({ sticker }: { sticker: StickerAsset }) {
  if (sticker.archivedAt) {
    return (
      <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-amber-200">
        Архив
      </span>
    );
  }

  if (sticker.publishedAt) {
    return (
      <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-emerald-200">
        Live
      </span>
    );
  }

  return (
    <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
      Hidden
    </span>
  );
}
