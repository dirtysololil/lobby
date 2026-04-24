"use client";

import type { StickerAsset, StickerPack } from "@lobby/shared";
import {
  adminStickerPacksResponseSchema,
  stickerPackResponseSchema,
  stickerResponseSchema,
} from "@lobby/shared";
import {
  FolderPlus,
  ImagePlus,
  Search,
  Sticker as StickerIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { EditStickerDrawer, type StickerDraft } from "@/components/admin/edit-sticker-drawer";
import {
  EditStickerPackDrawer,
  type StickerPackDraft,
} from "@/components/admin/edit-sticker-pack-drawer";
import {
  ConfirmDialog,
  KebabMenu,
  StatusBadge,
} from "@/components/admin/sticker-admin-ui";
import { StickerGridCard } from "@/components/admin/sticker-grid-card";
import { StickerPackListItem } from "@/components/admin/sticker-pack-list-item";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { apiClientFetch } from "@/lib/api-client";
import { reorderItems } from "@/lib/stickers";

interface StickerPacksAdminPanelProps {
  initialPacks: StickerPack[];
}

type DeleteTarget =
  | {
      type: "pack";
      pack: StickerPack;
    }
  | {
      type: "sticker";
      sticker: StickerAsset;
    };

const emptyPackDraft: StickerPackDraft = {
  title: "",
  description: "",
  isPublished: true,
  isDiscoverable: true,
  isHidden: false,
  isArchived: false,
};

const emptyStickerDraft: StickerDraft = {
  title: "",
  keywords: "",
  isPublished: true,
  isHidden: false,
  isArchived: false,
};

const primaryAdminButtonClass =
  "h-10 rounded-[12px] border-white bg-white px-4 text-sm text-black hover:border-white hover:bg-neutral-100";

const secondaryAdminButtonClass =
  "h-10 rounded-[12px] border-white/8 bg-black px-4 text-sm text-white hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)]";

const searchInputClass =
  "h-10 border-0 bg-transparent px-0 text-sm text-white shadow-none focus:ring-0";

export function StickerPacksAdminPanel({
  initialPacks,
}: StickerPacksAdminPanelProps) {
  const [packs, setPacks] = useState(initialPacks);
  const [selectedPackId, setSelectedPackId] = useState<string | null>(
    initialPacks[0]?.id ?? null,
  );
  const [packSearch, setPackSearch] = useState("");
  const [stickerSearch, setStickerSearch] = useState("");
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [packDrawerMode, setPackDrawerMode] = useState<"create" | "edit" | null>(null);
  const [packDraft, setPackDraft] = useState<StickerPackDraft>(emptyPackDraft);
  const [editingStickerId, setEditingStickerId] = useState<string | null>(null);
  const [stickerDraft, setStickerDraft] = useState<StickerDraft>(emptyStickerDraft);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!selectedPackId || !packs.some((pack) => pack.id === selectedPackId)) {
      setSelectedPackId(packs[0]?.id ?? null);
    }
  }, [packs, selectedPackId]);

  const selectedPack = useMemo(
    () => packs.find((pack) => pack.id === selectedPackId) ?? null,
    [packs, selectedPackId],
  );

  const editingSticker = useMemo(
    () => selectedPack?.stickers.find((sticker) => sticker.id === editingStickerId) ?? null,
    [editingStickerId, selectedPack],
  );

  const filteredPacks = useMemo(() => {
    const query = packSearch.trim().toLowerCase();

    if (!query) {
      return packs;
    }

    return packs.filter((pack) =>
      [pack.title, pack.description ?? "", ...pack.stickers.map((sticker) => sticker.title)]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [packSearch, packs]);

  const visibleStickers = useMemo(() => {
    const query = stickerSearch.trim().toLowerCase();

    if (!selectedPack) {
      return [];
    }

    if (!query) {
      return selectedPack.stickers;
    }

    return selectedPack.stickers.filter((sticker) =>
      [sticker.title, sticker.originalName ?? "", ...sticker.keywords]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [selectedPack, stickerSearch]);

  const totalStickerCount = useMemo(
    () => packs.reduce((sum, pack) => sum + pack.stickerCount, 0),
    [packs],
  );
  const activePackCount = useMemo(
    () =>
      packs.filter((pack) => pack.isPublished && !pack.isHidden && !pack.isArchived).length,
    [packs],
  );
  const draftPackCount = useMemo(
    () => packs.filter((pack) => !pack.isPublished).length,
    [packs],
  );
  const archivedPackCount = useMemo(
    () => packs.filter((pack) => pack.isArchived).length,
    [packs],
  );

  function setPackDraftFromPack(pack: StickerPack | null) {
    if (!pack) {
      setPackDraft(emptyPackDraft);
      return;
    }

    setPackDraft({
      title: pack.title,
      description: pack.description ?? "",
      isPublished: pack.isPublished,
      isDiscoverable: pack.isDiscoverable,
      isHidden: pack.isHidden,
      isArchived: pack.isArchived,
    });
  }

  function setStickerDraftFromSticker(sticker: StickerAsset | null) {
    if (!sticker) {
      setStickerDraft(emptyStickerDraft);
      return;
    }

    setStickerDraft({
      title: sticker.title,
      keywords: sticker.keywords.join(", "),
      isPublished: sticker.isPublished,
      isHidden: sticker.isHidden,
      isArchived: sticker.isArchived,
    });
  }

  async function refreshPacks(options?: {
    selectedPackId?: string | null;
    editingStickerId?: string | null;
  }) {
    const payload = await apiClientFetch("/v1/stickers/admin/packs");
    const nextPacks = adminStickerPacksResponseSchema.parse(payload).packs;
    const nextSelectedPackId =
      options?.selectedPackId ??
      nextPacks.find((pack) => pack.id === selectedPackId)?.id ??
      nextPacks[0]?.id ??
      null;

    setPacks(nextPacks);
    setSelectedPackId(nextSelectedPackId);

    const nextSelectedPack =
      nextPacks.find((pack) => pack.id === nextSelectedPackId) ?? null;
    const nextEditingStickerId =
      options?.editingStickerId ??
      (nextSelectedPack?.stickers.some((sticker) => sticker.id === editingStickerId)
        ? editingStickerId
        : null);

    setEditingStickerId(nextEditingStickerId ?? null);

    if (nextEditingStickerId && nextSelectedPack) {
      setStickerDraftFromSticker(
        nextSelectedPack.stickers.find((sticker) => sticker.id === nextEditingStickerId) ?? null,
      );
    }
  }

  async function runAction(key: string, action: () => Promise<void>) {
    setPendingKey(key);
    setError(null);

    try {
      await action();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Не удалось выполнить действие.",
      );
    } finally {
      setPendingKey(null);
    }
  }

  function openCreatePackDrawer() {
    setPackDraft(emptyPackDraft);
    setPackDrawerMode("create");
    setError(null);
  }

  function openEditPackDrawer(pack = selectedPack) {
    if (!pack) {
      return;
    }

    setPackDraftFromPack(pack);
    setPackDrawerMode("edit");
    setError(null);
  }

  function openStickerDrawer(sticker: StickerAsset) {
    setEditingStickerId(sticker.id);
    setStickerDraftFromSticker(sticker);
    setError(null);
  }

  async function handleSavePack() {
    if (!packDraft.title.trim()) {
      setError("Введите название набора.");
      return;
    }

    await runAction(
      packDrawerMode === "create" ? "pack:create" : `pack:save:${selectedPack?.id ?? "draft"}`,
      async () => {
        if (packDrawerMode === "create") {
          const payload = await apiClientFetch("/v1/stickers/packs", {
            method: "POST",
            body: JSON.stringify({
              title: packDraft.title.trim(),
              description: packDraft.description.trim() || null,
              isPublished: packDraft.isPublished,
              isDiscoverable: packDraft.isDiscoverable,
            }),
          });
          const pack = stickerPackResponseSchema.parse(payload).pack;
          await refreshPacks({ selectedPackId: pack.id });
          setStatus("Набор создан.");
        } else if (selectedPack) {
          const payload = await apiClientFetch(`/v1/stickers/packs/${selectedPack.id}`, {
            method: "PATCH",
            body: JSON.stringify({
              title: packDraft.title.trim(),
              description: packDraft.description.trim() || null,
              isPublished: packDraft.isPublished,
              isDiscoverable: packDraft.isDiscoverable,
              isHidden: packDraft.isHidden,
              isArchived: packDraft.isArchived,
            }),
          });
          const pack = stickerPackResponseSchema.parse(payload).pack;
          await refreshPacks({ selectedPackId: pack.id });
          setStatus("Набор обновлён.");
        }

        setPackDrawerMode(null);
      },
    );
  }

  async function handleDeletePack(pack = selectedPack) {
    if (!pack) {
      return;
    }

    await runAction(`pack:delete:${pack.id}`, async () => {
      await apiClientFetch(`/v1/stickers/packs/${pack.id}`, {
        method: "DELETE",
      });
      await refreshPacks({
        selectedPackId:
          packs.find((item) => item.id !== pack.id)?.id ?? null,
      });
      setPackDrawerMode(null);
      setStatus("Набор удалён.");
    });
  }

  function requestDeletePack(pack = selectedPack) {
    if (!pack) {
      return;
    }

    setDeleteTarget({ type: "pack", pack });
  }

  async function handleMovePack(packId: string, direction: -1 | 1) {
    const currentIndex = packs.findIndex((pack) => pack.id === packId);
    const nextIndex = currentIndex + direction;

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= packs.length) {
      return;
    }

    await runAction(`pack:reorder:${packId}`, async () => {
      const ordered = reorderItems(packs, currentIndex, nextIndex);
      await apiClientFetch("/v1/stickers/packs/reorder", {
        method: "POST",
        body: JSON.stringify({
          packIds: ordered.map((pack) => pack.id),
        }),
      });
      await refreshPacks({ selectedPackId: packId });
    });
  }

  async function uploadStickers(files: File[]) {
    if (!selectedPack || files.length === 0) {
      return;
    }

    await runAction(`pack:upload:${selectedPack.id}`, async () => {
      let firstStickerId: string | null = null;

      for (const [index, file] of files.entries()) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append(
          "title",
          file.name.replace(/\.[^.]+$/, "").trim() || `Стикер ${index + 1}`,
        );

        const payload = await apiClientFetch(`/v1/stickers/packs/${selectedPack.id}/stickers`, {
          method: "POST",
          body: formData,
        });
        const sticker = stickerResponseSchema.parse(payload).sticker;

        if (!firstStickerId) {
          firstStickerId = sticker.id;
        }
      }

      await refreshPacks({
        selectedPackId: selectedPack.id,
        editingStickerId: files.length === 1 ? firstStickerId : null,
      });

      setStatus(
        files.length === 1
          ? "Стикер загружен."
          : `Загружено стикеров: ${files.length}.`,
      );
    });
  }

  async function handleSaveSticker() {
    if (!selectedPack || !editingSticker || !stickerDraft.title.trim()) {
      setError("Введите название стикера.");
      return;
    }

    await runAction(`sticker:save:${editingSticker.id}`, async () => {
      const payload = await apiClientFetch(
        `/v1/stickers/packs/${selectedPack.id}/stickers/${editingSticker.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            title: stickerDraft.title.trim(),
            keywords: parseKeywords(stickerDraft.keywords),
            isPublished: stickerDraft.isPublished,
            isHidden: stickerDraft.isHidden,
            isArchived: stickerDraft.isArchived,
          }),
        },
      );
      stickerResponseSchema.parse(payload);
      await refreshPacks({
        selectedPackId: selectedPack.id,
        editingStickerId: editingSticker.id,
      });
      setStatus("Стикер обновлён.");
    });
  }

  async function handleDeleteSticker(sticker = editingSticker) {
    if (!selectedPack || !sticker) {
      return;
    }

    await runAction(`sticker:delete:${sticker.id}`, async () => {
      await apiClientFetch(`/v1/stickers/packs/${selectedPack.id}/stickers/${sticker.id}`, {
        method: "DELETE",
      });
      await refreshPacks({ selectedPackId: selectedPack.id, editingStickerId: null });
      setEditingStickerId(null);
      setStatus("Стикер удалён.");
    });
  }

  function requestDeleteSticker(sticker = editingSticker) {
    if (!selectedPack || !sticker) {
      return;
    }

    setDeleteTarget({ type: "sticker", sticker });
  }

  async function confirmDeleteTarget() {
    if (!deleteTarget) {
      return;
    }

    if (deleteTarget.type === "pack") {
      await handleDeletePack(deleteTarget.pack);
    } else {
      await handleDeleteSticker(deleteTarget.sticker);
    }

    setDeleteTarget(null);
  }

  async function handleMakeCover(sticker = editingSticker) {
    if (!selectedPack || !sticker) {
      return;
    }

    await runAction(`sticker:cover:${sticker.id}`, async () => {
      const payload = await apiClientFetch(`/v1/stickers/packs/${selectedPack.id}/cover`, {
        method: "POST",
        body: JSON.stringify({
          stickerId: sticker.id,
        }),
      });
      stickerPackResponseSchema.parse(payload);
      await refreshPacks({
        selectedPackId: selectedPack.id,
        editingStickerId: sticker.id,
      });
      setStatus("Обложка обновлена.");
    });
  }

  async function handleMoveSticker(stickerId: string, direction: -1 | 1) {
    if (!selectedPack) {
      return;
    }

    const currentIndex = selectedPack.stickers.findIndex((sticker) => sticker.id === stickerId);
    const nextIndex = currentIndex + direction;

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= selectedPack.stickers.length) {
      return;
    }

    await runAction(`sticker:reorder:${stickerId}`, async () => {
      const ordered = reorderItems(selectedPack.stickers, currentIndex, nextIndex);
      await apiClientFetch(`/v1/stickers/packs/${selectedPack.id}/stickers/reorder`, {
        method: "POST",
        body: JSON.stringify({
          stickerIds: ordered.map((sticker) => sticker.id),
        }),
      });
      await refreshPacks({ selectedPackId: selectedPack.id, editingStickerId });
    });
  }

  return (
    <>
      <div className="grid gap-3">
        <section className="premium-panel rounded-[20px] px-3 py-3 md:px-4">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] border border-[var(--border-soft)] bg-black text-white">
                <StickerIcon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="section-kicker">Sticker packs</p>
                <h2 className="mt-1 truncate text-[22px] font-semibold tracking-normal text-white">
                  Наборы стикеров
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--text-dim)]">
                <StatusBadge label={`${packs.length} наборов`} tone="neutral" />
                <StatusBadge label={`${totalStickerCount} стикеров`} tone="neutral" />
                <StatusBadge label={`${activePackCount} активных`} tone="live" />
                {draftPackCount + archivedPackCount > 0 ? (
                  <StatusBadge
                    label={`${draftPackCount + archivedPackCount} неактивных`}
                    tone="warning"
                  />
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
              <Button
                type="button"
                onClick={openCreatePackDrawer}
                className={primaryAdminButtonClass}
              >
                <FolderPlus className="h-4 w-4" />
                Набор
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={!selectedPack || pendingKey?.startsWith("pack:upload:") === true}
                onClick={() => uploadInputRef.current?.click()}
                className={secondaryAdminButtonClass}
              >
                <ImagePlus className="h-4 w-4" />
                Стикер
              </Button>
            </div>
          </div>

          <div className="mt-3 grid gap-2 lg:grid-cols-2">
            <label className="flex min-h-10 items-center gap-2 rounded-[12px] border border-[var(--border)] bg-black px-3 text-[var(--text-muted)] transition-colors focus-within:border-[var(--border-strong)] focus-within:ring-2 focus-within:ring-[var(--ring)]">
              <Search className="h-4 w-4 shrink-0" />
              <Input
                value={packSearch}
                onChange={(event) => setPackSearch(event.target.value)}
                placeholder="Поиск по наборам"
                className={searchInputClass}
              />
            </label>
            <label className="flex min-h-10 items-center gap-2 rounded-[12px] border border-[var(--border)] bg-black px-3 text-[var(--text-muted)] transition-colors focus-within:border-[var(--border-strong)] focus-within:ring-2 focus-within:ring-[var(--ring)]">
              <Search className="h-4 w-4 shrink-0" />
              <Input
                value={stickerSearch}
                onChange={(event) => setStickerSearch(event.target.value)}
                placeholder="Поиск по стикерам"
                className={searchInputClass}
              />
            </label>
          </div>

          <input
            ref={uploadInputRef}
            type="file"
            accept="image/png,image/webp,image/gif"
            multiple
            className="hidden"
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              event.currentTarget.value = "";
              void uploadStickers(files);
            }}
          />

          {error ? (
            <div className="mt-3 rounded-[12px] border border-rose-400/20 bg-black px-3 py-2 text-sm text-rose-100">
              {error}
            </div>
          ) : null}
          {status ? (
            <div className="mt-3 rounded-[12px] border border-emerald-400/20 bg-black px-3 py-2 text-sm text-emerald-100">
              {status}
            </div>
          ) : null}
        </section>

        <section className="grid gap-3 xl:grid-cols-[292px_minmax(0,1fr)]">
          <aside className="premium-panel rounded-[20px] p-2">
            <div className="flex items-center justify-between gap-2 border-b border-[var(--border-soft)] px-2 py-2">
              <div>
                <p className="section-kicker">Каталог</p>
                <div className="mt-1 text-sm font-semibold text-white">
                  {filteredPacks.length} из {packs.length}
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={openCreatePackDrawer}
                className="h-8 rounded-[10px] border-white/8 bg-black px-2.5 hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)]"
              >
                <FolderPlus className="h-3.5 w-3.5" />
                Новый
              </Button>
            </div>

            <div className="mt-2 grid gap-1.5">
              {filteredPacks.length === 0 ? (
                <EmptyState
                  title="Ничего не найдено"
                  description="Измените запрос или создайте новый набор."
                  action={
                    <Button
                      type="button"
                      size="sm"
                      onClick={openCreatePackDrawer}
                      className={primaryAdminButtonClass}
                    >
                      <FolderPlus className="h-4 w-4" />
                      Создать
                    </Button>
                  }
                />
              ) : (
                filteredPacks.map((pack) => (
                  <StickerPackListItem
                    key={pack.id}
                    pack={pack}
                    selected={pack.id === selectedPackId}
                    canMoveUp={packs.findIndex((item) => item.id === pack.id) > 0}
                    canMoveDown={
                      packs.findIndex((item) => item.id === pack.id) < packs.length - 1
                    }
                    onSelect={() => setSelectedPackId(pack.id)}
                    onEdit={() => openEditPackDrawer(pack)}
                    onMoveUp={() => void handleMovePack(pack.id, -1)}
                    onMoveDown={() => void handleMovePack(pack.id, 1)}
                    onDelete={() => requestDeletePack(pack)}
                  />
                ))
              )}
            </div>
          </aside>

          <section className="premium-panel rounded-[20px] p-3">
            {!selectedPack ? (
              <EmptyState
                title="Выберите набор"
                description="Слева показан каталог. Новый набор можно создать сверху."
                action={
                  <Button
                    type="button"
                    size="sm"
                    onClick={openCreatePackDrawer}
                    className={primaryAdminButtonClass}
                  >
                    <FolderPlus className="h-4 w-4" />
                    Новый набор
                  </Button>
                }
              />
            ) : (
              <div className="grid gap-3">
                <div className="rounded-[16px] border border-[var(--border)] bg-black px-3 py-3">
                  <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="section-kicker">Выбранный набор</p>
                        <StatusBadge label={`${selectedPack.stickerCount} шт.`} tone="neutral" />
                        {selectedPack.coverStickerId ? (
                          <StatusBadge label="Обложка" tone="accent" />
                        ) : null}
                      </div>
                      <h3 className="mt-2 truncate text-lg font-semibold tracking-normal text-white">
                        {selectedPack.title}
                      </h3>
                      {selectedPack.description?.trim() ? (
                        <p className="mt-1 line-clamp-1 text-sm text-[var(--text-dim)]">
                          {selectedPack.description}
                        </p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap items-center gap-1">
                        {selectedPack.isPublished &&
                        !selectedPack.isHidden &&
                        !selectedPack.isArchived ? (
                          <StatusBadge label="Активен" tone="live" />
                        ) : null}
                        {!selectedPack.isPublished ? (
                          <StatusBadge label="Черновик" tone="neutral" />
                        ) : null}
                        {selectedPack.isDiscoverable && selectedPack.isPublished ? (
                          <StatusBadge label="Поиск" tone="accent" />
                        ) : null}
                        {selectedPack.isHidden ? (
                          <StatusBadge label="Скрыт" tone="warning" />
                        ) : null}
                        {selectedPack.isArchived ? (
                          <StatusBadge label="Архив" tone="danger" />
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => openEditPackDrawer(selectedPack)}
                        className={secondaryAdminButtonClass}
                      >
                        Редактировать
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => uploadInputRef.current?.click()}
                        disabled={pendingKey?.startsWith("pack:upload:") === true}
                        className={secondaryAdminButtonClass}
                      >
                        <ImagePlus className="h-4 w-4" />
                        Добавить
                      </Button>
                      <KebabMenu
                        items={[
                          {
                            label: "Редактировать набор",
                            onSelect: () => openEditPackDrawer(selectedPack),
                          },
                          {
                            label: "Поднять выше",
                            onSelect: () => void handleMovePack(selectedPack.id, -1),
                            disabled: packs.findIndex((pack) => pack.id === selectedPack.id) === 0,
                          },
                          {
                            label: "Опустить ниже",
                            onSelect: () => void handleMovePack(selectedPack.id, 1),
                            disabled:
                              packs.findIndex((pack) => pack.id === selectedPack.id) ===
                              packs.length - 1,
                          },
                          {
                            label: "Удалить набор",
                            onSelect: () => requestDeletePack(selectedPack),
                            destructive: true,
                          },
                        ]}
                      />
                    </div>
                  </div>
                </div>

                {visibleStickers.length === 0 ? (
                  <EmptyState
                    title="Стикеры не найдены"
                    description={
                      stickerSearch
                        ? "Измените запрос или очистите поиск."
                        : "Загрузите первый файл в выбранный набор."
                    }
                    action={
                      !stickerSearch ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => uploadInputRef.current?.click()}
                          className={secondaryAdminButtonClass}
                        >
                          <ImagePlus className="h-4 w-4" />
                          Добавить стикер
                        </Button>
                      ) : undefined
                    }
                  />
                ) : (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(144px,1fr))] gap-2.5">
                    {visibleStickers.map((sticker) => (
                      <StickerGridCard
                        key={sticker.id}
                        sticker={sticker}
                        isCover={selectedPack.coverStickerId === sticker.id}
                        canMoveUp={
                          selectedPack.stickers.findIndex((item) => item.id === sticker.id) > 0
                        }
                        canMoveDown={
                          selectedPack.stickers.findIndex((item) => item.id === sticker.id) <
                          selectedPack.stickers.length - 1
                        }
                        onOpen={() => openStickerDrawer(sticker)}
                        onMoveUp={() => void handleMoveSticker(sticker.id, -1)}
                        onMoveDown={() => void handleMoveSticker(sticker.id, 1)}
                        onMakeCover={() => void handleMakeCover(sticker)}
                        onDelete={() => requestDeleteSticker(sticker)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        </section>
      </div>

      <EditStickerPackDrawer
        open={packDrawerMode !== null}
        mode={packDrawerMode ?? "create"}
        draft={packDraft}
        saving={pendingKey === "pack:create" || pendingKey?.startsWith("pack:save:") === true}
        deleting={pendingKey?.startsWith("pack:delete:") === true}
        onClose={() => setPackDrawerMode(null)}
        onChange={(patch) => setPackDraft((current) => ({ ...current, ...patch }))}
        onSave={() => void handleSavePack()}
        onDelete={packDrawerMode === "edit" ? () => requestDeletePack(selectedPack) : undefined}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title={
          deleteTarget?.type === "pack"
            ? "Удалить набор?"
            : "Удалить стикер?"
        }
        description={
          deleteTarget?.type === "pack"
            ? `Набор «${deleteTarget.pack.title}» и его стикеры будут скрыты из каталога.`
            : deleteTarget
              ? `Стикер «${deleteTarget.sticker.title}» будет удалён из выбранного набора.`
              : ""
        }
        pending={
          pendingKey?.startsWith("pack:delete:") === true ||
          pendingKey?.startsWith("sticker:delete:") === true
        }
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDeleteTarget()}
      />

      <EditStickerDrawer
        open={editingSticker !== null}
        sticker={editingSticker}
        isCover={Boolean(editingSticker && selectedPack?.coverStickerId === editingSticker.id)}
        draft={stickerDraft}
        saving={pendingKey?.startsWith("sticker:save:") === true}
        deleting={pendingKey?.startsWith("sticker:delete:") === true}
        onClose={() => setEditingStickerId(null)}
        onChange={(patch) => setStickerDraft((current) => ({ ...current, ...patch }))}
        onSave={() => void handleSaveSticker()}
        onDelete={() => requestDeleteSticker()}
        onMakeCover={() => void handleMakeCover()}
      />
    </>
  );
}

function parseKeywords(value: string) {
  return value
    .split(/[,\n]/g)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 24);
}
