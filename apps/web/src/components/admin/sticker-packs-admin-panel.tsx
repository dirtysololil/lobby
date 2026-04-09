"use client";

import type { StickerAsset, StickerPack } from "@lobby/shared";
import {
  adminStickerPacksResponseSchema,
  stickerPackResponseSchema,
  stickerResponseSchema,
} from "@lobby/shared";
import {
  Activity,
  FolderPlus,
  ImagePlus,
  Layers3,
  Search,
  Sparkles,
  Sticker as StickerIcon,
  type LucideIcon,
} from "lucide-react";
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
  type ReactNode,
} from "react";
import { EditStickerDrawer, type StickerDraft } from "@/components/admin/edit-sticker-drawer";
import {
  EditStickerPackDrawer,
  type StickerPackDraft,
} from "@/components/admin/edit-sticker-pack-drawer";
import { KebabMenu, StatusBadge } from "@/components/admin/sticker-admin-ui";
import { StickerGridCard } from "@/components/admin/sticker-grid-card";
import { StickerPackListItem } from "@/components/admin/sticker-pack-list-item";
import { StickerAssetPreview } from "@/components/messages/sticker-asset-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClientFetch } from "@/lib/api-client";
import { reorderItems } from "@/lib/stickers";
import { cn } from "@/lib/utils";

interface StickerPacksAdminPanelProps {
  initialPacks: StickerPack[];
}

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

const workspaceLayoutStyle = {
  ["--sidebar-width" as string]: "318px",
  ["--sticker-grid-min" as string]: "224px",
} as CSSProperties;

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
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const deferredPackQuery = useDeferredValue(packSearch.trim().toLowerCase());
  const deferredStickerQuery = useDeferredValue(stickerSearch.trim().toLowerCase());

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
    if (!deferredPackQuery) {
      return packs;
    }

    return packs.filter((pack) =>
      [pack.title, pack.description ?? "", ...pack.stickers.map((sticker) => sticker.title)]
        .join(" ")
        .toLowerCase()
        .includes(deferredPackQuery),
    );
  }, [deferredPackQuery, packs]);

  const visibleStickers = useMemo(() => {
    if (!selectedPack) {
      return [];
    }

    if (!deferredStickerQuery) {
      return selectedPack.stickers;
    }

    return selectedPack.stickers.filter((sticker) =>
      [sticker.title, sticker.originalName ?? "", ...sticker.keywords]
        .join(" ")
        .toLowerCase()
        .includes(deferredStickerQuery),
    );
  }, [deferredStickerQuery, selectedPack]);

  const workspaceStats = useMemo(() => {
    const totalStickers = packs.reduce((sum, pack) => sum + pack.stickerCount, 0);
    const livePackCount = packs.filter(isPackLive).length;
    const searchablePackCount = packs.filter(
      (pack) => isPackLive(pack) && pack.isDiscoverable,
    ).length;
    const animatedStickerCount = packs.reduce(
      (sum, pack) => sum + pack.stickers.filter((sticker) => sticker.isAnimated).length,
      0,
    );

    return {
      totalPacks: packs.length,
      totalStickers,
      livePackCount,
      searchablePackCount,
      animatedStickerCount,
    };
  }, [packs]);

  const selectedPackCover = useMemo(() => getCoverSticker(selectedPack), [selectedPack]);
  const selectedPackAnimatedCount = useMemo(
    () => selectedPack?.stickers.filter((sticker) => sticker.isAnimated).length ?? 0,
    [selectedPack],
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

    const nextSelectedPack =
      nextPacks.find((pack) => pack.id === nextSelectedPackId) ?? null;
    const nextEditingStickerId =
      options?.editingStickerId ??
      (nextSelectedPack?.stickers.some((sticker) => sticker.id === editingStickerId)
        ? editingStickerId
        : null);
    const nextEditingSticker =
      nextEditingStickerId && nextSelectedPack
        ? nextSelectedPack.stickers.find((sticker) => sticker.id === nextEditingStickerId) ?? null
        : null;

    startTransition(() => {
      setPacks(nextPacks);
      setSelectedPackId(nextSelectedPackId);
      setEditingStickerId(nextEditingStickerId ?? null);
      setStickerDraftFromSticker(nextEditingSticker);
    });
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
      setError("Введите название пака.");
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
          setStatus("Пак создан.");
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
          setStatus("Пак обновлён.");
        }

        setPackDrawerMode(null);
      },
    );
  }

  async function handleDeletePack(pack = selectedPack) {
    if (!pack) {
      return;
    }

    if (!window.confirm(`Удалить пак «${pack.title}»?`)) {
      return;
    }

    await runAction(`pack:delete:${pack.id}`, async () => {
      await apiClientFetch(`/v1/stickers/packs/${pack.id}`, {
        method: "DELETE",
      });
      await refreshPacks({
        selectedPackId: packs.find((item) => item.id !== pack.id)?.id ?? null,
      });
      setPackDrawerMode(null);
      setStatus("Пак удалён.");
    });
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

    if (!window.confirm(`Удалить стикер «${sticker.title}»?`)) {
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
      <div style={workspaceLayoutStyle} className="relative isolate grid gap-5">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-80 rounded-[40px] bg-[radial-gradient(circle_at_14%_6%,rgba(77,141,255,0.24),transparent_32%),radial-gradient(circle_at_82%_0%,rgba(34,197,139,0.16),transparent_24%)] blur-3xl opacity-80" />

        <section className="relative overflow-hidden rounded-[30px] border border-[color:var(--sw-border)] bg-[radial-gradient(circle_at_top_left,rgba(77,141,255,0.14),transparent_28%),radial-gradient(circle_at_86%_0%,rgba(34,197,139,0.1),transparent_20%),linear-gradient(180deg,rgba(255,255,255,0.045),transparent_24%),linear-gradient(180deg,var(--sw-bg-alt),var(--sw-bg))] p-4 shadow-[var(--sw-shadow-panel)] sm:p-5">
          <WorkspaceEdgeLight />

          <div className="grid gap-5">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
              <div className="grid gap-5 xl:max-w-3xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-[color:rgba(77,141,255,0.22)] bg-[rgba(77,141,255,0.12)] px-3 py-1 text-[11px] font-medium tracking-[0.08em] text-[color:var(--sw-text-secondary)]">
                    <StickerIcon className="h-3.5 w-3.5" />
                    Sticker packs
                  </span>
                  <span className="inline-flex items-center rounded-full border border-[color:var(--sw-border)] bg-white/[0.04] px-3 py-1 text-[11px] font-medium text-[color:var(--sw-text-muted)]">
                    Compact workspace
                  </span>
                </div>

                <div>
                  <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-[color:var(--sw-text-muted)]">
                    Catalog operations
                  </div>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-[color:var(--sw-text)] sm:text-[2.1rem]">
                    Compact workspace
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--sw-text-muted)]">
                    Управляйте паками, обложками и поисковой видимостью в одном плотном
                    тёмном workspace с более выразительной иерархией и живыми карточками.
                  </p>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  <WorkspaceMetricTile label="Всего паков" value={workspaceStats.totalPacks} icon={Layers3} accent="blue" />
                  <WorkspaceMetricTile label="Live" value={workspaceStats.livePackCount} icon={Activity} accent="green" />
                  <WorkspaceMetricTile label="Searchable" value={workspaceStats.searchablePackCount} icon={Search} accent="green" />
                  <WorkspaceMetricTile label="Animated" value={workspaceStats.animatedStickerCount} icon={Sparkles} accent="blue" />
                </div>
              </div>

              <div className="w-full max-w-[720px] rounded-[26px] border border-[color:var(--sw-border)] bg-[linear-gradient(180deg,rgba(17,29,48,0.92),rgba(10,18,32,0.94))] p-3 shadow-[var(--sw-shadow-card)]">
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center">
                  <WorkspaceSearchField
                    value={stickerSearch}
                    onChange={setStickerSearch}
                    placeholder={selectedPack ? "Поиск по стикерам выбранного пака" : "Сначала выберите пак"}
                    meta={selectedPack ? `Текущий пак: ${selectedPack.title}` : "Поиск по стикерам"}
                    disabled={!selectedPack}
                    trailing={
                      <span className="inline-flex min-h-7 items-center rounded-full border border-[color:var(--sw-border)] bg-white/[0.04] px-2.5 text-[11px] font-medium text-[color:var(--sw-text-secondary)]">
                        {selectedPack ? `${visibleStickers.length}/${selectedPack.stickerCount}` : "idle"}
                      </span>
                    }
                  />

                  <WorkspaceButton type="button" tone="primary" onClick={openCreatePackDrawer}>
                    <FolderPlus className="h-4 w-4" />
                    Создать пак
                  </WorkspaceButton>

                  <WorkspaceButton
                    type="button"
                    tone="secondary"
                    disabled={!selectedPack}
                    onClick={() => uploadInputRef.current?.click()}
                  >
                    <ImagePlus className="h-4 w-4" />
                    Добавить стикер
                  </WorkspaceButton>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-full border border-[color:var(--sw-border)] bg-white/[0.04] px-3 py-1 text-[11px] font-medium text-[color:var(--sw-text-secondary)]">
                    {selectedPack ? selectedPack.title : "Пак не выбран"}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-[color:var(--sw-border-soft)] bg-white/[0.03] px-3 py-1 text-[11px] text-[color:var(--sw-text-muted)]">
                    {selectedPack ? `Видимых карточек: ${visibleStickers.length}` : "Выберите пак, чтобы загрузить стикеры"}
                  </span>
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
              </div>
            </div>

            {error ? <WorkspaceBanner tone="error">{error}</WorkspaceBanner> : null}
            {status ? <WorkspaceBanner tone="success">{status}</WorkspaceBanner> : null}
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(290px,var(--sidebar-width))_minmax(0,1fr)]">
          <aside className="relative rounded-[30px] border border-[color:var(--sw-border)] bg-[linear-gradient(180deg,rgba(17,29,48,0.92),rgba(10,18,32,0.96))] shadow-[var(--sw-shadow-panel)] xl:sticky xl:top-4 xl:self-start">
            <WorkspaceEdgeLight />

            <div className="p-4 sm:p-5">
              <div className="flex items-end justify-between gap-3 border-b border-[color:var(--sw-border-soft)] pb-4">
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[color:var(--sw-text-muted)]">
                    Library
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <h3 className="text-base font-semibold tracking-[-0.03em] text-[color:var(--sw-text)]">
                      Sticker packs
                    </h3>
                    <span className="inline-flex min-h-7 items-center rounded-full border border-[color:var(--sw-border)] bg-white/[0.04] px-2.5 text-[11px] text-[color:var(--sw-text-secondary)]">
                      {packs.length}
                    </span>
                  </div>
                  <p className="mt-2 max-w-[22rem] text-sm leading-5 text-[color:var(--sw-text-muted)]">
                    Быстрый доступ к live, hidden и archived пакам без лишней пустоты.
                  </p>
                </div>

                <WorkspaceButton
                  type="button"
                  tone="ghost"
                  className="h-10 px-3 text-xs"
                  onClick={openCreatePackDrawer}
                >
                  <FolderPlus className="h-4 w-4" />
                  Новый
                </WorkspaceButton>
              </div>

              <div className="mt-4">
                <WorkspaceSearchField
                  value={packSearch}
                  onChange={setPackSearch}
                  placeholder="Поиск по пакам"
                  meta="Pack library"
                  trailing={
                    <span className="inline-flex min-h-7 items-center rounded-full border border-[color:var(--sw-border-soft)] bg-white/[0.03] px-2.5 text-[11px] text-[color:var(--sw-text-muted)]">
                      {filteredPacks.length}
                    </span>
                  }
                />
              </div>

              <div className="mt-4 grid max-h-[calc(100vh-280px)] gap-2.5 overflow-y-auto pr-1">
                {filteredPacks.length === 0 ? (
                  <WorkspaceEmptyState
                    icon={<Search className="h-5 w-5" />}
                    title="Паки не найдены"
                    description={
                      packSearch
                        ? "Измените запрос или очистите поиск, чтобы вернуть список."
                        : "Создайте первый пак и начните наполнять библиотеку."
                    }
                    action={
                      packSearch ? (
                        <WorkspaceButton
                          type="button"
                          tone="ghost"
                          className="h-10"
                          onClick={() => setPackSearch("")}
                        >
                          Очистить поиск
                        </WorkspaceButton>
                      ) : (
                        <WorkspaceButton type="button" tone="primary" onClick={openCreatePackDrawer}>
                          <FolderPlus className="h-4 w-4" />
                          Создать пак
                        </WorkspaceButton>
                      )
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
                      onDelete={() => void handleDeletePack(pack)}
                    />
                  ))
                )}
              </div>

              <div className="mt-4 flex items-center justify-between rounded-[18px] border border-[color:var(--sw-border-soft)] bg-white/[0.03] px-3 py-2.5 text-[11px] text-[color:var(--sw-text-muted)]">
                <span>Показано {filteredPacks.length} из {packs.length}</span>
                <span>{workspaceStats.livePackCount} live</span>
              </div>
            </div>
          </aside>

          <section className="relative rounded-[30px] border border-[color:var(--sw-border)] bg-[linear-gradient(180deg,rgba(17,29,48,0.92),rgba(10,18,32,0.96))] shadow-[var(--sw-shadow-panel)]">
            <WorkspaceEdgeLight />

            {!selectedPack ? (
              <div className="p-4 sm:p-5">
                <WorkspaceEmptyState
                  className="min-h-[560px]"
                  icon={<StickerIcon className="h-5 w-5" />}
                  title="Выберите пак"
                  description="Выберите sticker pack слева, чтобы управлять обложкой, порядком, публикацией и поиском."
                  action={
                    <WorkspaceButton type="button" tone="primary" onClick={openCreatePackDrawer}>
                      <FolderPlus className="h-4 w-4" />
                      Создать пак
                    </WorkspaceButton>
                  }
                />
              </div>
            ) : (
              <div className="grid gap-4 p-4 sm:p-5">
                <div className="sticky top-4 z-10">
                  <div className="relative rounded-[28px] border border-[color:var(--sw-border)] bg-[radial-gradient(circle_at_top_left,rgba(77,141,255,0.16),transparent_32%),radial-gradient(circle_at_88%_0%,rgba(34,197,139,0.12),transparent_20%),linear-gradient(180deg,rgba(255,255,255,0.05),transparent_24%),linear-gradient(180deg,var(--sw-surface-3),var(--sw-surface-1))] shadow-[var(--sw-shadow-card)]">
                    <WorkspaceEdgeLight />

                    <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_180px] lg:items-start">
                      <div className="grid gap-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center rounded-full border border-[color:var(--sw-border)] bg-white/[0.04] px-3 py-1 text-[11px] font-medium text-[color:var(--sw-text-secondary)]">
                            Selected pack
                          </span>
                          <span className="inline-flex items-center rounded-full border border-[color:var(--sw-border-soft)] bg-white/[0.03] px-3 py-1 text-[11px] text-[color:var(--sw-text-muted)]">
                            /{selectedPack.slug}
                          </span>
                        </div>

                        <div>
                          <h3 className="text-xl font-semibold tracking-[-0.05em] text-[color:var(--sw-text)]">
                            {selectedPack.title}
                          </h3>
                          <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--sw-text-muted)]">
                            {selectedPack.description?.trim() ||
                              "Управляйте публикацией, поисковой выдачей и обложкой пака в одном плотном командном блоке."}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          <StatusBadge label={`${selectedPack.stickerCount} pcs`} tone="neutral" />
                          {isPackLive(selectedPack) ? <StatusBadge label="Live" tone="live" /> : null}
                          {!selectedPack.isPublished ? (
                            <StatusBadge label="Draft" tone="neutral" />
                          ) : null}
                          {selectedPack.isDiscoverable && selectedPack.isPublished ? (
                            <StatusBadge label="Search" tone="accent" />
                          ) : null}
                          {selectedPack.isHidden ? (
                            <StatusBadge label="Hidden" tone="warning" />
                          ) : null}
                          {selectedPack.isArchived ? (
                            <StatusBadge label="Archive" tone="danger" />
                          ) : null}
                          {selectedPackAnimatedCount > 0 ? (
                            <StatusBadge label={`${selectedPackAnimatedCount} Gif`} tone="neutral" />
                          ) : null}
                        </div>

                        <div className="grid gap-2 sm:grid-cols-3">
                          <WorkspaceDetailTile label="Updated" value={formatWorkspaceDate(selectedPack.updatedAt)} />
                          <WorkspaceDetailTile label="Cover" value={selectedPackCover?.title ?? "Not set"} />
                          <WorkspaceDetailTile
                            label="Search"
                            value={selectedPack.isDiscoverable && selectedPack.isPublished ? "Enabled" : "Private"}
                            accent={selectedPack.isDiscoverable && selectedPack.isPublished ? "green" : "blue"}
                          />
                        </div>
                      </div>

                      <div className="grid gap-3">
                        <div className="relative overflow-hidden rounded-[24px] border border-[color:var(--sw-border)] bg-[radial-gradient(circle_at_28%_18%,rgba(77,141,255,0.18),transparent_40%),linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                          {selectedPackCover ? (
                            <StickerAssetPreview
                              sticker={selectedPackCover}
                              className="aspect-square rounded-[18px]"
                              imageClassName="h-full w-full object-contain p-4"
                            />
                          ) : (
                            <div className="flex aspect-square items-center justify-center rounded-[18px] border border-dashed border-[color:var(--sw-border)] text-[12px] text-[color:var(--sw-text-muted)]">
                              Cover preview
                            </div>
                          )}
                        </div>

                        <WorkspaceButton
                          type="button"
                          tone="secondary"
                          className="w-full justify-start"
                          onClick={() => openEditPackDrawer(selectedPack)}
                        >
                          Edit pack
                        </WorkspaceButton>

                        <WorkspaceButton
                          type="button"
                          tone="secondary"
                          className="w-full justify-start"
                          onClick={() => uploadInputRef.current?.click()}
                        >
                          Add sticker
                        </WorkspaceButton>

                        <div className="flex items-center justify-between rounded-[18px] border border-[color:var(--sw-border-soft)] bg-white/[0.03] px-3 py-2.5">
                          <span className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--sw-text-muted)]">
                            Pack actions
                          </span>
                          <KebabMenu
                            items={[
                              {
                                label: "Редактировать пак",
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
                                disabled: packs.findIndex((pack) => pack.id === selectedPack.id) === packs.length - 1,
                              },
                              {
                                label: "Удалить пак",
                                onSelect: () => void handleDeletePack(selectedPack),
                                destructive: true,
                              },
                            ]}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="relative rounded-[28px] border border-[color:var(--sw-border)] bg-[linear-gradient(180deg,rgba(14,23,39,0.94),rgba(10,18,32,0.96))] p-4 shadow-[var(--sw-shadow-card)]">
                  <WorkspaceEdgeLight tone="green" />

                  <div className="flex flex-col gap-4 border-b border-[color:var(--sw-border-soft)] pb-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[color:var(--sw-text-muted)]">
                        Sticker grid
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <h4 className="text-base font-semibold tracking-[-0.03em] text-[color:var(--sw-text)]">
                          Pack assets
                        </h4>
                        <span className="inline-flex min-h-7 items-center rounded-full border border-[color:var(--sw-border)] bg-white/[0.04] px-2.5 text-[11px] text-[color:var(--sw-text-secondary)]">
                          {visibleStickers.length} visible
                        </span>
                        {deferredStickerQuery ? (
                          <span className="inline-flex min-h-7 items-center rounded-full border border-[color:rgba(77,141,255,0.18)] bg-[rgba(77,141,255,0.1)] px-2.5 text-[11px] text-[color:var(--sw-text-secondary)]">
                            Filtered
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm leading-6 text-[color:var(--sw-text-muted)]">
                        Крупные карточки выносят превью, метаданные и статусы наверх, сохраняя
                        компактный рабочий ритм.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex min-h-10 items-center rounded-full border border-[color:var(--sw-border-soft)] bg-white/[0.03] px-3 text-[12px] text-[color:var(--sw-text-muted)]">
                        Всего в паке: {selectedPack.stickers.length}
                      </span>
                      {deferredStickerQuery ? (
                        <WorkspaceButton
                          type="button"
                          tone="ghost"
                          className="h-10"
                          onClick={() => setStickerSearch("")}
                        >
                          Сбросить поиск
                        </WorkspaceButton>
                      ) : null}
                    </div>
                  </div>

                  {visibleStickers.length === 0 ? (
                    <div className="pt-4">
                      <WorkspaceEmptyState
                        className="min-h-[360px]"
                        icon={<Search className="h-5 w-5" />}
                        title="Стикеры не найдены"
                        description={
                          deferredStickerQuery
                            ? "Измените запрос или очистите поиск, чтобы снова увидеть карточки."
                            : "Добавьте первый стикер в выбранный пак, чтобы заполнить сетку."
                        }
                        action={
                          deferredStickerQuery ? (
                            <WorkspaceButton
                              type="button"
                              tone="ghost"
                              className="h-10"
                              onClick={() => setStickerSearch("")}
                            >
                              Очистить поиск
                            </WorkspaceButton>
                          ) : (
                            <WorkspaceButton
                              type="button"
                              tone="primary"
                              onClick={() => uploadInputRef.current?.click()}
                            >
                              <ImagePlus className="h-4 w-4" />
                              Добавить стикер
                            </WorkspaceButton>
                          )
                        }
                      />
                    </div>
                  ) : (
                    <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(var(--sticker-grid-min),1fr))] gap-4">
                      {visibleStickers.map((sticker) => (
                        <StickerGridCard
                          key={sticker.id}
                          sticker={sticker}
                          isCover={selectedPack.coverStickerId === sticker.id}
                          isSelected={editingStickerId === sticker.id}
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
                          onDelete={() => void handleDeleteSticker(sticker)}
                        />
                      ))}
                    </div>
                  )}
                </div>
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
        onDelete={packDrawerMode === "edit" ? () => void handleDeletePack(selectedPack) : undefined}
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
        onDelete={() => void handleDeleteSticker()}
        onMakeCover={() => void handleMakeCover()}
      />
    </>
  );
}

type WorkspaceButtonProps = ComponentProps<typeof Button> & {
  tone?: "primary" | "secondary" | "ghost";
};

function WorkspaceButton({
  tone = "secondary",
  className,
  ...props
}: WorkspaceButtonProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        "h-11 rounded-[16px] border px-4 text-[13px] font-semibold tracking-[-0.01em] transition-[transform,border-color,background,box-shadow,color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sw-focus)] disabled:cursor-not-allowed disabled:opacity-40",
        tone === "primary" &&
          "border-[color:rgba(77,141,255,0.24)] bg-[linear-gradient(180deg,rgba(93,153,255,0.34),rgba(56,102,191,0.72))] text-white shadow-[0_18px_38px_rgba(34,77,155,0.24)] hover:-translate-y-[1px] hover:border-[color:rgba(125,173,255,0.36)] hover:bg-[linear-gradient(180deg,rgba(101,159,255,0.38),rgba(64,110,202,0.78))]",
        tone === "secondary" &&
          "border-[color:var(--sw-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] text-[color:var(--sw-text-secondary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] hover:-translate-y-[1px] hover:border-[color:var(--sw-border-strong)] hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.04))] hover:text-[color:var(--sw-text)]",
        tone === "ghost" &&
          "border-[color:transparent] bg-transparent text-[color:var(--sw-text-muted)] hover:border-[color:var(--sw-border)] hover:bg-white/[0.05] hover:text-[color:var(--sw-text)]",
        className,
      )}
      {...props}
    />
  );
}

function WorkspaceMetricTile({
  label,
  value,
  icon: Icon,
  accent = "blue",
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  accent?: "blue" | "green";
}) {
  return (
    <div className="rounded-[20px] border border-[color:var(--sw-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-[color:var(--sw-text-muted)]">
            {label}
          </div>
          <div className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[color:var(--sw-text)]">
            {value.toLocaleString("ru-RU")}
          </div>
        </div>
        <div
          className={cn(
            "inline-flex h-10 w-10 items-center justify-center rounded-[14px] border shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
            accent === "blue" &&
              "border-[color:rgba(77,141,255,0.22)] bg-[rgba(77,141,255,0.12)] text-sky-200",
            accent === "green" &&
              "border-[color:rgba(34,197,139,0.22)] bg-[rgba(34,197,139,0.12)] text-emerald-200",
          )}
        >
          <Icon className="h-4.5 w-4.5" />
        </div>
      </div>
    </div>
  );
}

function WorkspaceDetailTile({
  label,
  value,
  accent = "neutral",
}: {
  label: string;
  value: string;
  accent?: "blue" | "green" | "neutral";
}) {
  return (
    <div
      className={cn(
        "rounded-[18px] border px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
        accent === "neutral" && "border-[color:var(--sw-border-soft)] bg-white/[0.03]",
        accent === "blue" && "border-[color:rgba(77,141,255,0.18)] bg-[rgba(77,141,255,0.08)]",
        accent === "green" &&
          "border-[color:rgba(34,197,139,0.18)] bg-[rgba(34,197,139,0.08)]",
      )}
    >
      <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-[color:var(--sw-text-muted)]">
        {label}
      </div>
      <div className="mt-1 truncate text-[13px] font-medium text-[color:var(--sw-text-secondary)]">
        {value}
      </div>
    </div>
  );
}

function WorkspaceSearchField({
  value,
  onChange,
  placeholder,
  meta,
  trailing,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  meta?: string;
  trailing?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "group flex min-h-[54px] items-center gap-3 rounded-[20px] border border-[color:var(--sw-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] px-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-[border-color,background,box-shadow] duration-200 hover:border-[color:var(--sw-border-strong)] hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.025))] focus-within:border-[color:rgba(77,141,255,0.24)] focus-within:ring-2 focus-within:ring-[color:var(--sw-focus)]",
        disabled && "opacity-60",
      )}
    >
      <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] border border-[color:var(--sw-border-soft)] bg-white/[0.04] text-[color:var(--sw-text-muted)]">
        <Search className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        {meta ? (
          <div className="mb-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-[color:var(--sw-text-muted)]">
            {meta}
          </div>
        ) : null}
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="h-auto border-0 bg-transparent px-0 py-0 text-sm text-[color:var(--sw-text)] placeholder:text-[color:var(--sw-text-muted)] focus-visible:ring-0"
        />
      </div>

      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </label>
  );
}

function WorkspaceBanner({
  tone,
  children,
}: {
  tone: "error" | "success";
  children: ReactNode;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-center gap-3 rounded-[18px] border px-4 py-3 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
        tone === "error" &&
          "border-[color:rgba(251,113,133,0.18)] bg-[linear-gradient(180deg,rgba(251,113,133,0.14),rgba(251,113,133,0.08))] text-rose-50",
        tone === "success" &&
          "border-[color:rgba(34,197,139,0.18)] bg-[linear-gradient(180deg,rgba(34,197,139,0.14),rgba(34,197,139,0.08))] text-emerald-50",
      )}
    >
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          tone === "error" && "bg-rose-300",
          tone === "success" && "bg-emerald-300",
        )}
      />
      <span>{children}</span>
    </div>
  );
}

function WorkspaceEmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[260px] flex-col items-center justify-center rounded-[26px] border border-[color:var(--sw-border-soft)] bg-[radial-gradient(circle_at_top,rgba(77,141,255,0.1),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] px-6 py-10 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
        className,
      )}
    >
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-[18px] border border-[color:var(--sw-border)] bg-white/[0.05] text-[color:var(--sw-text-secondary)]">
        {icon}
      </div>
      <div className="mt-4">
        <p className="text-base font-semibold tracking-[-0.03em] text-[color:var(--sw-text)]">
          {title}
        </p>
        <p className="mt-2 max-w-md text-sm leading-6 text-[color:var(--sw-text-muted)]">
          {description}
        </p>
      </div>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

function WorkspaceEdgeLight({ tone = "blue" }: { tone?: "blue" | "green" }) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-5 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(145,170,210,0.48),transparent)]",
        tone === "green" &&
          "bg-[linear-gradient(90deg,transparent,rgba(34,197,139,0.42),transparent)]",
      )}
    />
  );
}

function isPackLive(pack: StickerPack) {
  return pack.isPublished && !pack.isHidden && !pack.isArchived;
}

function getCoverSticker(pack: StickerPack | null) {
  if (!pack) {
    return null;
  }

  return (
    pack.stickers.find((sticker) => sticker.id === pack.coverStickerId) ??
    pack.stickers[0] ??
    null
  );
}

function formatWorkspaceDate(value: string) {
  return workspaceDateFormatter.format(new Date(value));
}

function parseKeywords(value: string) {
  return value
    .split(/[,\n]/g)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 24);
}

const workspaceDateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});
