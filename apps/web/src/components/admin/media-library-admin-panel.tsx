"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type {
  AdminMediaLibrary,
  PublicUser,
  StickerPack,
  StickerAsset,
} from "@lobby/shared";
import {
  adminMediaLibraryResponseSchema,
  customEmojiResponseSchema,
  gifAssetResponseSchema,
  stickerPackResponseSchema,
  stickerResponseSchema,
} from "@lobby/shared";
import {
  ArrowDown,
  ArrowUp,
  Film,
  FolderPlus,
  ImagePlus,
  Laugh,
  Search,
  Sticker,
  Trash2,
} from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { apiClientFetch } from "@/lib/api-client";
import { getCustomEmojiAssetUrl, reorderItems } from "@/lib/stickers";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { GifAssetPreview } from "@/components/messages/gif-asset-preview";
import { StickerAssetPreview } from "@/components/messages/sticker-asset-preview";
import { cn } from "@/lib/utils";

type AdminMediaTab = "emoji" | "gif" | "sticker";
type EmojiDraft = { alias: string; title: string };
type GifDraft = { title: string; tags: string };

interface MediaLibraryAdminPanelProps {
  viewer: PublicUser;
  initialLibrary: AdminMediaLibrary;
}

const iconProps = { size: 18, strokeWidth: 1.5 } as const;
const viewerRoleLabels: Record<PublicUser["role"], string> = {
  OWNER: "Владелец",
  ADMIN: "Администратор",
  MEMBER: "Участник",
};

export function MediaLibraryAdminPanel({
  viewer,
  initialLibrary,
}: MediaLibraryAdminPanelProps) {
  const [library, setLibrary] = useState(initialLibrary);
  const [activeTab, setActiveTab] = useState<AdminMediaTab>("emoji");
  const [search, setSearch] = useState("");
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [newEmojiAlias, setNewEmojiAlias] = useState("");
  const [newEmojiTitle, setNewEmojiTitle] = useState("");
  const [newEmojiFile, setNewEmojiFile] = useState<File | null>(null);
  const [newGifTitle, setNewGifTitle] = useState("");
  const [newGifTags, setNewGifTags] = useState("");
  const [newGifFile, setNewGifFile] = useState<File | null>(null);
  const [newPackTitle, setNewPackTitle] = useState("");
  const [selectedPackId, setSelectedPackId] = useState<string | null>(
    initialLibrary.stickerPacks[0]?.id ?? null,
  );
  const [packTitleDraft, setPackTitleDraft] = useState("");
  const [stickerTitleDraft, setStickerTitleDraft] = useState("");
  const [stickerFiles, setStickerFiles] = useState<File[]>([]);
  const [emojiDrafts, setEmojiDrafts] = useState<Record<string, EmojiDraft>>({});
  const [gifDrafts, setGifDrafts] = useState<Record<string, GifDraft>>({});

  useEffect(() => {
    setLibrary(initialLibrary);
  }, [initialLibrary]);

  useEffect(() => {
    setEmojiDrafts(
      Object.fromEntries(
        library.emojis.map((emoji) => [
          emoji.id,
          { alias: emoji.alias, title: emoji.title },
        ]),
      ),
    );
    setGifDrafts(
      Object.fromEntries(
        library.gifs.map((gif) => [
          gif.id,
          { title: gif.title, tags: gif.tags.join(", ") },
        ]),
      ),
    );
  }, [library.emojis, library.gifs]);

  useEffect(() => {
    const nextSelectedPack =
      library.stickerPacks.find((pack) => pack.id === selectedPackId) ??
      library.stickerPacks[0] ??
      null;

    setSelectedPackId(nextSelectedPack?.id ?? null);
    setPackTitleDraft(nextSelectedPack?.title ?? "");
  }, [library.stickerPacks, selectedPackId]);

  const selectedPack = useMemo(
    () => library.stickerPacks.find((pack) => pack.id === selectedPackId) ?? null,
    [library.stickerPacks, selectedPackId],
  );

  const filteredEmojis = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return library.emojis;
    return library.emojis.filter((emoji) =>
      [emoji.alias, emoji.title].some((candidate) =>
        candidate.toLowerCase().includes(query),
      ),
    );
  }, [library.emojis, search]);

  const filteredGifs = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return library.gifs;
    return library.gifs.filter((gif) =>
      [gif.title, ...gif.tags].some((candidate) =>
        candidate.toLowerCase().includes(query),
      ),
    );
  }, [library.gifs, search]);

  const filteredPacks = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return library.stickerPacks;
    return library.stickerPacks.filter((pack) =>
      [pack.title, ...pack.stickers.map((sticker) => sticker.title)].some((candidate) =>
        candidate.toLowerCase().includes(query),
      ),
    );
  }, [library.stickerPacks, search]);

  const visibleStickers = useMemo(() => {
    if (!selectedPack) return [];
    const query = search.trim().toLowerCase();
    if (!query) return selectedPack.stickers;
    return selectedPack.stickers.filter((sticker) =>
      [sticker.title, sticker.originalName ?? ""].some((candidate) =>
        candidate.toLowerCase().includes(query),
      ),
    );
  }, [search, selectedPack]);

  async function refreshLibrary(nextSelectedPackId?: string | null) {
    const payload = await apiClientFetch("/v1/admin/media/library");
    const nextLibrary = adminMediaLibraryResponseSchema.parse(payload).library;
    setLibrary(nextLibrary);
    setSelectedPackId(
      nextSelectedPackId ??
        nextLibrary.stickerPacks.find((pack) => pack.id === selectedPackId)?.id ??
        nextLibrary.stickerPacks[0]?.id ??
        null,
    );
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

  function parseTags(value: string) {
    return value
      .split(/[\n,]/g)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 12);
  }

  async function handleCreateEmoji() {
    if (!newEmojiFile) {
      setError("Выберите файл смайлика.");
      return;
    }

    await runAction("emoji:create", async () => {
      const formData = new FormData();
      formData.append("file", newEmojiFile);
      formData.append("alias", newEmojiAlias.trim());

      if (newEmojiTitle.trim()) {
        formData.append("title", newEmojiTitle.trim());
      }

      const payload = await apiClientFetch("/v1/admin/media/emojis", {
        method: "POST",
        body: formData,
      });
      customEmojiResponseSchema.parse(payload);
      await refreshLibrary();
      setNewEmojiAlias("");
      setNewEmojiTitle("");
      setNewEmojiFile(null);
      setStatus("Смайлик загружен.");
    });
  }

  async function handleSaveEmoji(emojiId: string) {
    const draft = emojiDrafts[emojiId];
    if (!draft) return;

    await runAction(`emoji:save:${emojiId}`, async () => {
      const payload = await apiClientFetch(`/v1/admin/media/emojis/${emojiId}`, {
        method: "PATCH",
        body: JSON.stringify({
          alias: draft.alias.trim(),
          title: draft.title.trim(),
        }),
      });
      customEmojiResponseSchema.parse(payload);
      await refreshLibrary();
      setStatus("Смайлик обновлён.");
    });
  }

  async function moveEmoji(emojiId: string, direction: -1 | 1) {
    const currentIndex = library.emojis.findIndex((emoji) => emoji.id === emojiId);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= library.emojis.length) {
      return;
    }

    await runAction(`emoji:reorder:${emojiId}`, async () => {
      const ordered = reorderItems(library.emojis, currentIndex, nextIndex);
      await apiClientFetch("/v1/admin/media/emojis/reorder", {
        method: "POST",
        body: JSON.stringify({
          emojiIds: ordered.map((emoji) => emoji.id),
        }),
      });
      await refreshLibrary();
    });
  }

  async function toggleEmoji(emojiId: string, isActive: boolean) {
    await runAction(`emoji:toggle:${emojiId}`, async () => {
      const payload = await apiClientFetch(`/v1/admin/media/emojis/${emojiId}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
      });
      customEmojiResponseSchema.parse(payload);
      await refreshLibrary();
      setStatus(isActive ? "Смайлик включён." : "Смайлик скрыт.");
    });
  }

  async function deleteEmoji(emojiId: string) {
    if (!window.confirm("Удалить этот смайлик из библиотеки?")) {
      return;
    }

    await runAction(`emoji:delete:${emojiId}`, async () => {
      await apiClientFetch(`/v1/admin/media/emojis/${emojiId}`, {
        method: "DELETE",
      });
      await refreshLibrary();
      setStatus("Смайлик удалён.");
    });
  }

  async function handleCreateGif() {
    if (!newGifFile) {
      setError("Выберите GIF-файл.");
      return;
    }

    await runAction("gif:create", async () => {
      const formData = new FormData();
      formData.append("file", newGifFile);
      formData.append("title", newGifTitle.trim());

      for (const tag of parseTags(newGifTags)) {
        formData.append("tags", tag);
      }

      const payload = await apiClientFetch("/v1/admin/media/gifs", {
        method: "POST",
        body: formData,
      });
      gifAssetResponseSchema.parse(payload);
      await refreshLibrary();
      setNewGifTitle("");
      setNewGifTags("");
      setNewGifFile(null);
      setStatus("GIF загружен.");
    });
  }

  async function handleSaveGif(gifId: string) {
    const draft = gifDrafts[gifId];
    if (!draft) return;

    await runAction(`gif:save:${gifId}`, async () => {
      const payload = await apiClientFetch(`/v1/admin/media/gifs/${gifId}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: draft.title.trim(),
          tags: parseTags(draft.tags),
        }),
      });
      gifAssetResponseSchema.parse(payload);
      await refreshLibrary();
      setStatus("GIF обновлён.");
    });
  }

  async function moveGif(gifId: string, direction: -1 | 1) {
    const currentIndex = library.gifs.findIndex((gif) => gif.id === gifId);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= library.gifs.length) {
      return;
    }

    await runAction(`gif:reorder:${gifId}`, async () => {
      const ordered = reorderItems(library.gifs, currentIndex, nextIndex);
      await apiClientFetch("/v1/admin/media/gifs/reorder", {
        method: "POST",
        body: JSON.stringify({
          gifIds: ordered.map((gif) => gif.id),
        }),
      });
      await refreshLibrary();
    });
  }

  async function toggleGif(gifId: string, isActive: boolean) {
    await runAction(`gif:toggle:${gifId}`, async () => {
      const payload = await apiClientFetch(`/v1/admin/media/gifs/${gifId}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
      });
      gifAssetResponseSchema.parse(payload);
      await refreshLibrary();
      setStatus(isActive ? "GIF включён." : "GIF скрыт.");
    });
  }

  async function deleteGif(gifId: string) {
    if (!window.confirm("Удалить этот GIF из библиотеки?")) {
      return;
    }

    await runAction(`gif:delete:${gifId}`, async () => {
      await apiClientFetch(`/v1/admin/media/gifs/${gifId}`, {
        method: "DELETE",
      });
      await refreshLibrary();
      setStatus("GIF удалён.");
    });
  }

  async function handleCreatePack() {
    await runAction("pack:create", async () => {
      const payload = await apiClientFetch("/v1/stickers/packs", {
        method: "POST",
        body: JSON.stringify({
          title: newPackTitle.trim(),
        }),
      });
      const pack = stickerPackResponseSchema.parse(payload).pack;
      await refreshLibrary(pack.id);
      setNewPackTitle("");
      setStatus("Набор создан.");
    });
  }

  async function handleSavePack() {
    if (!selectedPack) return;

    await runAction(`pack:save:${selectedPack.id}`, async () => {
      const payload = await apiClientFetch(`/v1/stickers/packs/${selectedPack.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: packTitleDraft.trim(),
          isActive: selectedPack.isActive,
        }),
      });
      stickerPackResponseSchema.parse(payload);
      await refreshLibrary(selectedPack.id);
      setStatus("Набор обновлён.");
    });
  }

  async function togglePack(isActive: boolean) {
    if (!selectedPack) return;

    await runAction(`pack:toggle:${selectedPack.id}`, async () => {
      const payload = await apiClientFetch(`/v1/stickers/packs/${selectedPack.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
      });
      stickerPackResponseSchema.parse(payload);
      await refreshLibrary(selectedPack.id);
      setStatus(isActive ? "Набор включён." : "Набор скрыт.");
    });
  }

  async function movePack(packId: string, direction: -1 | 1) {
    const currentIndex = library.stickerPacks.findIndex((pack) => pack.id === packId);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= library.stickerPacks.length) {
      return;
    }

    await runAction(`pack:reorder:${packId}`, async () => {
      const ordered = reorderItems(library.stickerPacks, currentIndex, nextIndex);
      await apiClientFetch("/v1/stickers/packs/reorder", {
        method: "POST",
        body: JSON.stringify({
          packIds: ordered.map((pack) => pack.id),
        }),
      });
      await refreshLibrary(packId);
    });
  }

  async function deletePack() {
    if (!selectedPack) return;
    if (!window.confirm(`Удалить набор «${selectedPack.title}»?`)) {
      return;
    }

    await runAction(`pack:delete:${selectedPack.id}`, async () => {
      await apiClientFetch(`/v1/stickers/packs/${selectedPack.id}`, {
        method: "DELETE",
      });
      await refreshLibrary(null);
      setStatus("Набор удалён.");
    });
  }

  async function handleUploadStickers() {
    if (!selectedPack || stickerFiles.length === 0) {
      setError("Выберите хотя бы один стикер.");
      return;
    }

    await runAction(`pack:upload:${selectedPack.id}`, async () => {
      for (const [index, file] of stickerFiles.entries()) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append(
          "title",
          stickerFiles.length === 1 && stickerTitleDraft.trim()
            ? stickerTitleDraft.trim()
            : file.name.replace(/\.[^.]+$/, "").trim() || `Стикер ${index + 1}`,
        );
        const payload = await apiClientFetch(`/v1/stickers/packs/${selectedPack.id}/stickers`, {
          method: "POST",
          body: formData,
        });
        stickerResponseSchema.parse(payload);
      }

      await refreshLibrary(selectedPack.id);
      setStickerFiles([]);
      setStickerTitleDraft("");
      setStatus(
        stickerFiles.length === 1
          ? "Стикер загружен."
          : `Загружено стикеров: ${stickerFiles.length}.`,
      );
    });
  }

  async function toggleSticker(sticker: StickerAsset, isActive: boolean) {
    if (!selectedPack) return;

    await runAction(`sticker:toggle:${sticker.id}`, async () => {
      const payload = await apiClientFetch(
        `/v1/stickers/packs/${selectedPack.id}/stickers/${sticker.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ isActive }),
        },
      );
      stickerResponseSchema.parse(payload);
      await refreshLibrary(selectedPack.id);
      setStatus(isActive ? "Стикер включён." : "Стикер скрыт.");
    });
  }

  async function moveSticker(stickerId: string, direction: -1 | 1) {
    if (!selectedPack) return;

    const currentIndex = selectedPack.stickers.findIndex((sticker) => sticker.id === stickerId);
    const nextIndex = currentIndex + direction;
    if (
      currentIndex < 0 ||
      nextIndex < 0 ||
      nextIndex >= selectedPack.stickers.length
    ) {
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
      await refreshLibrary(selectedPack.id);
    });
  }

  async function deleteSticker(stickerId: string) {
    if (!selectedPack) return;
    if (!window.confirm("Удалить этот стикер?")) {
      return;
    }

    await runAction(`sticker:delete:${stickerId}`, async () => {
      await apiClientFetch(`/v1/stickers/packs/${selectedPack.id}/stickers/${stickerId}`, {
        method: "DELETE",
      });
      await refreshLibrary(selectedPack.id);
      setStatus("Стикер удалён.");
    });
  }

  const renderEmojiTab = () => (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
      <div className="premium-panel rounded-[24px] p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white">Кастомные смайлики</h2>
            <p className="mt-1 text-sm text-[var(--text-dim)]">
              Загружайте свои смайлики, задавайте алиас и управляйте видимостью в панели выбора.
            </p>
          </div>
          <span className="status-pill">
            <Laugh {...iconProps} />
            {library.emojis.length}
          </span>
        </div>

        <div className="mt-5 grid gap-3 rounded-[20px] border border-white/8 bg-white/[0.03] p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              value={newEmojiAlias}
              onChange={(event) => setNewEmojiAlias(event.target.value)}
              placeholder="Алиас, например party_blob"
              className="h-11 border-white/8 bg-white/[0.03] text-white"
            />
            <Input
              value={newEmojiTitle}
              onChange={(event) => setNewEmojiTitle(event.target.value)}
              placeholder="Название смайлика"
              className="h-11 border-white/8 bg-white/[0.03] text-white"
            />
          </div>

          <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-[18px] border border-dashed border-white/10 bg-white/[0.02] px-4 py-5 text-center">
            <ImagePlus {...iconProps} className="text-[var(--text-soft)]" />
            <span className="mt-2 text-sm text-white">
              {newEmojiFile ? newEmojiFile.name : "Выберите PNG / WEBP / GIF"}
            </span>
            <span className="mt-1 text-xs text-[var(--text-dim)]">
              Файл будет доступен в панели выбора после загрузки.
            </span>
            <input
              type="file"
              accept="image/png,image/webp,image/gif"
              className="hidden"
              onChange={(event) =>
                setNewEmojiFile(event.target.files?.[0] ?? null)
              }
            />
          </label>

          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => void handleCreateEmoji()}
              disabled={pendingKey === "emoji:create"}
            >
              Добавить смайлик
            </Button>
          </div>
        </div>

        <div className="mt-5 grid gap-3">
          {filteredEmojis.length === 0 ? (
            <EmptyState
              title="Смайлики не найдены"
              description="Загрузите первый смайлик или измените поисковый запрос."
            />
          ) : (
            filteredEmojis.map((emoji) => {
              const draft = emojiDrafts[emoji.id] ?? {
                alias: emoji.alias,
                title: emoji.title,
              };

              return (
                <div
                  key={emoji.id}
                  className="grid gap-3 rounded-[20px] border border-white/8 bg-white/[0.03] p-4 xl:grid-cols-[72px_minmax(0,1fr)_auto]"
                >
                  <div className="flex h-[72px] w-[72px] items-center justify-center rounded-[18px] border border-white/8 bg-[rgba(11,16,24,0.86)]">
                    <img
                      src={getCustomEmojiAssetUrl(emoji)}
                      alt={emoji.title}
                      className="max-h-12 max-w-12 object-contain"
                    />
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <Input
                      value={draft.alias}
                      onChange={(event) =>
                        setEmojiDrafts((current) => ({
                          ...current,
                          [emoji.id]: {
                            ...draft,
                            alias: event.target.value,
                          },
                        }))
                      }
                      placeholder="Алиас"
                      className="h-10 border-white/8 bg-white/[0.03] text-white"
                    />
                    <Input
                      value={draft.title}
                      onChange={(event) =>
                        setEmojiDrafts((current) => ({
                          ...current,
                          [emoji.id]: {
                            ...draft,
                            title: event.target.value,
                          },
                        }))
                      }
                      placeholder="Название"
                      className="h-10 border-white/8 bg-white/[0.03] text-white"
                    />
                    <div className="md:col-span-2 flex items-center justify-between gap-3">
                      <StatusPill active={emoji.isActive} />
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          onClick={() => void handleSaveEmoji(emoji.id)}
                          disabled={pendingKey === `emoji:save:${emoji.id}`}
                        >
                          Сохранить
                        </Button>
                        <Button
                          type="button"
                          onClick={() => void toggleEmoji(emoji.id, !emoji.isActive)}
                          disabled={pendingKey === `emoji:toggle:${emoji.id}`}
                        >
                          {emoji.isActive ? "Скрыть" : "Включить"}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start justify-end gap-2">
                    <IconButton
                      label="Поднять"
                      disabled={
                        pendingKey !== null ||
                        library.emojis.findIndex((item) => item.id === emoji.id) === 0
                      }
                      onClick={() => moveEmoji(emoji.id, -1)}
                      icon={<ArrowUp {...iconProps} />}
                    />
                    <IconButton
                      label="Опустить"
                      disabled={
                        pendingKey !== null ||
                        library.emojis.findIndex((item) => item.id === emoji.id) ===
                          library.emojis.length - 1
                      }
                      onClick={() => moveEmoji(emoji.id, 1)}
                      icon={<ArrowDown {...iconProps} />}
                    />
                    <IconButton
                      label="Удалить"
                      disabled={pendingKey === `emoji:delete:${emoji.id}`}
                      onClick={() => deleteEmoji(emoji.id)}
                      icon={<Trash2 {...iconProps} />}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <aside className="premium-panel rounded-[24px] p-5">
        <h3 className="text-sm font-semibold text-white">Как это работает</h3>
        <div className="mt-4 grid gap-3 text-sm text-[var(--text-dim)]">
          <div className="rounded-[18px] border border-white/8 bg-white/[0.03] p-4">
            1. Загрузите файл смайлика и задайте алиас.
          </div>
          <div className="rounded-[18px] border border-white/8 bg-white/[0.03] p-4">
            2. При необходимости отредактируйте название и порядок.
          </div>
          <div className="rounded-[18px] border border-white/8 bg-white/[0.03] p-4">
            3. Скрытые смайлики остаются в истории, но исчезают из панели выбора.
          </div>
        </div>
      </aside>
    </section>
  );

  const renderGifTab = () => (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
      <div className="premium-panel rounded-[24px] p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white">GIF-библиотека</h2>
            <p className="mt-1 text-sm text-[var(--text-dim)]">
              Загружайте свои GIF и управляйте тем, что доступно в панели выбора.
            </p>
          </div>
          <span className="status-pill">
            <Film {...iconProps} />
            {library.gifs.length}
          </span>
        </div>

        <div className="mt-5 grid gap-3 rounded-[20px] border border-white/8 bg-white/[0.03] p-4">
          <Input
            value={newGifTitle}
            onChange={(event) => setNewGifTitle(event.target.value)}
            placeholder="Название GIF"
            className="h-11 border-white/8 bg-white/[0.03] text-white"
          />
          <Input
            value={newGifTags}
            onChange={(event) => setNewGifTags(event.target.value)}
            placeholder="Теги через запятую"
            className="h-11 border-white/8 bg-white/[0.03] text-white"
          />
          <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-[18px] border border-dashed border-white/10 bg-white/[0.02] px-4 py-5 text-center">
            <Film {...iconProps} className="text-[var(--text-soft)]" />
            <span className="mt-2 text-sm text-white">
              {newGifFile ? newGifFile.name : "Выберите GIF"}
            </span>
            <input
              type="file"
              accept="image/gif"
              className="hidden"
              onChange={(event) => setNewGifFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => void handleCreateGif()}
              disabled={pendingKey === "gif:create"}
            >
              Добавить GIF
            </Button>
          </div>
        </div>

        <div className="mt-5 grid gap-3">
          {filteredGifs.length === 0 ? (
            <EmptyState
              title="GIF не найдены"
              description="Загрузите первый GIF или измените поисковый запрос."
            />
          ) : (
            filteredGifs.map((gif) => {
              const draft = gifDrafts[gif.id] ?? {
                title: gif.title,
                tags: gif.tags.join(", "),
              };

              return (
                <div
                  key={gif.id}
                  className="grid gap-3 rounded-[20px] border border-white/8 bg-white/[0.03] p-4 xl:grid-cols-[minmax(0,1fr)_auto]"
                >
                  <div className="grid gap-3">
                    <Input
                      value={draft.title}
                      onChange={(event) =>
                        setGifDrafts((current) => ({
                          ...current,
                          [gif.id]: {
                            ...draft,
                            title: event.target.value,
                          },
                        }))
                      }
                      placeholder="Название GIF"
                      className="h-10 border-white/8 bg-white/[0.03] text-white"
                    />
                    <Input
                      value={draft.tags}
                      onChange={(event) =>
                        setGifDrafts((current) => ({
                          ...current,
                          [gif.id]: {
                            ...draft,
                            tags: event.target.value,
                          },
                        }))
                      }
                      placeholder="Теги"
                      className="h-10 border-white/8 bg-white/[0.03] text-white"
                    />
                    <div className="flex items-center justify-between gap-3">
                      <StatusPill active={gif.isActive} />
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          onClick={() => void handleSaveGif(gif.id)}
                          disabled={pendingKey === `gif:save:${gif.id}`}
                        >
                          Сохранить
                        </Button>
                        <Button
                          type="button"
                          onClick={() => void toggleGif(gif.id, !gif.isActive)}
                          disabled={pendingKey === `gif:toggle:${gif.id}`}
                        >
                          {gif.isActive ? "Скрыть" : "Включить"}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start justify-end gap-2">
                    <IconButton
                      label="Поднять"
                      disabled={
                        pendingKey !== null ||
                        library.gifs.findIndex((item) => item.id === gif.id) === 0
                      }
                      onClick={() => moveGif(gif.id, -1)}
                      icon={<ArrowUp {...iconProps} />}
                    />
                    <IconButton
                      label="Опустить"
                      disabled={
                        pendingKey !== null ||
                        library.gifs.findIndex((item) => item.id === gif.id) ===
                          library.gifs.length - 1
                      }
                      onClick={() => moveGif(gif.id, 1)}
                      icon={<ArrowDown {...iconProps} />}
                    />
                    <IconButton
                      label="Удалить"
                      disabled={pendingKey === `gif:delete:${gif.id}`}
                      onClick={() => deleteGif(gif.id)}
                      icon={<Trash2 {...iconProps} />}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <aside className="premium-panel rounded-[24px] p-5">
        <h3 className="text-sm font-semibold text-white">Подсказка</h3>
        <p className="mt-3 text-sm text-[var(--text-dim)]">
          Для GIF лучше использовать короткие названия и 2–5 тегов, чтобы панель выбора оставалась
          быстрым и понятным.
        </p>
      </aside>
    </section>
  );

  const renderStickerTab = () => (
    <section className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="premium-panel rounded-[24px] p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white">Наборы стикеров</h2>
            <p className="mt-1 text-sm text-[var(--text-dim)]">
              Создавайте наборы, управляйте порядком и видимостью.
            </p>
          </div>
          <span className="status-pill">
            <FolderPlus {...iconProps} />
            {library.stickerPacks.length}
          </span>
        </div>

        <div className="mt-4 grid gap-3 rounded-[20px] border border-white/8 bg-white/[0.03] p-4">
          <Input
            value={newPackTitle}
            onChange={(event) => setNewPackTitle(event.target.value)}
            placeholder="Название нового набора"
            className="h-11 border-white/8 bg-white/[0.03] text-white"
          />
          <Button
            type="button"
            onClick={() => void handleCreatePack()}
            disabled={pendingKey === "pack:create"}
          >
            Создать набор
          </Button>
        </div>

        <div className="mt-4 grid gap-2">
          {filteredPacks.length === 0 ? (
            <EmptyState
              title="Наборы не найдены"
              description="Создайте первый набор или измените поисковый запрос."
            />
          ) : (
            filteredPacks.map((pack) => (
              <button
                key={pack.id}
                type="button"
                onClick={() => setSelectedPackId(pack.id)}
                className={cn(
                  "rounded-[18px] border px-4 py-3 text-left transition-colors",
                  selectedPackId === pack.id
                    ? "border-white/14 bg-white/[0.08]"
                    : "border-white/8 bg-white/[0.03] hover:bg-white/[0.05]",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-white">{pack.title}</div>
                    <div className="mt-1 text-xs text-[var(--text-dim)]">
                      Стикеров: {pack.stickers.length}
                    </div>
                  </div>
                  <StatusPill active={pack.isActive} />
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      <div className="premium-panel rounded-[24px] p-5">
        {!selectedPack ? (
          <EmptyState
            title="Выберите набор"
            description="Слева отображаются все доступные наборы стикеров."
          />
        ) : (
          <>
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 flex-1">
                <Input
                  value={packTitleDraft}
                  onChange={(event) => setPackTitleDraft(event.target.value)}
                  placeholder="Название набора"
                  className="h-11 border-white/8 bg-white/[0.03] text-white"
                />
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    onClick={() => void handleSavePack()}
                    disabled={pendingKey === `pack:save:${selectedPack.id}`}
                  >
                    Сохранить набор
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void togglePack(!selectedPack.isActive)}
                    disabled={pendingKey === `pack:toggle:${selectedPack.id}`}
                  >
                    {selectedPack.isActive ? "Скрыть набор" : "Включить набор"}
                  </Button>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <IconButton
                  label="Поднять"
                  disabled={
                    pendingKey !== null ||
                    library.stickerPacks.findIndex((item) => item.id === selectedPack.id) === 0
                  }
                  onClick={() => movePack(selectedPack.id, -1)}
                  icon={<ArrowUp {...iconProps} />}
                />
                <IconButton
                  label="Опустить"
                  disabled={
                    pendingKey !== null ||
                    library.stickerPacks.findIndex((item) => item.id === selectedPack.id) ===
                      library.stickerPacks.length - 1
                  }
                  onClick={() => movePack(selectedPack.id, 1)}
                  icon={<ArrowDown {...iconProps} />}
                />
                <IconButton
                  label="Удалить набор"
                  disabled={pendingKey === `pack:delete:${selectedPack.id}`}
                  onClick={() => deletePack()}
                  icon={<Trash2 {...iconProps} />}
                />
              </div>
            </div>

            <div className="mt-5 grid gap-3 rounded-[20px] border border-white/8 bg-white/[0.03] p-4">
              <Input
                value={stickerTitleDraft}
                onChange={(event) => setStickerTitleDraft(event.target.value)}
                placeholder="Название стикера для одиночной загрузки"
                className="h-11 border-white/8 bg-white/[0.03] text-white"
              />
              <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-[18px] border border-dashed border-white/10 bg-white/[0.02] px-4 py-5 text-center">
                <ImagePlus {...iconProps} className="text-[var(--text-soft)]" />
                <span className="mt-2 text-sm text-white">
                  {stickerFiles.length > 0
                    ? `Выбрано файлов: ${stickerFiles.length}`
                    : "Выберите один или несколько стикеров"}
                </span>
                <input
                  type="file"
                  accept="image/png,image/webp,image/gif"
                  multiple
                  className="hidden"
                  onChange={(event) =>
                    setStickerFiles(Array.from(event.target.files ?? []))
                  }
                />
              </label>
              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={() => void handleUploadStickers()}
                  disabled={pendingKey === `pack:upload:${selectedPack.id}`}
                >
                  Загрузить стикеры
                </Button>
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              {visibleStickers.length === 0 ? (
                <EmptyState
                  title="Стикеры не найдены"
                  description="Загрузите первый стикер в набор или измените поисковый запрос."
                />
              ) : (
                visibleStickers.map((sticker) => (
                  <div
                    key={sticker.id}
                    className="grid gap-3 rounded-[20px] border border-white/8 bg-white/[0.03] p-4 xl:grid-cols-[minmax(0,1fr)_auto]"
                  >
                    <div>
                      <div className="text-sm font-medium text-white">{sticker.title}</div>
                      <div className="mt-1 text-xs text-[var(--text-dim)]">
                        {sticker.originalName ?? "Без исходного имени"}
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <StatusPill active={sticker.isActive} />
                        <Button
                          type="button"
                          onClick={() => void toggleSticker(sticker, !sticker.isActive)}
                          disabled={pendingKey === `sticker:toggle:${sticker.id}`}
                        >
                          {sticker.isActive ? "Скрыть" : "Включить"}
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-start justify-end gap-2">
                      <IconButton
                        label="Поднять"
                        disabled={
                          pendingKey !== null ||
                          selectedPack.stickers.findIndex((item) => item.id === sticker.id) === 0
                        }
                        onClick={() => moveSticker(sticker.id, -1)}
                        icon={<ArrowUp {...iconProps} />}
                      />
                      <IconButton
                        label="Опустить"
                        disabled={
                          pendingKey !== null ||
                          selectedPack.stickers.findIndex((item) => item.id === sticker.id) ===
                            selectedPack.stickers.length - 1
                        }
                        onClick={() => moveSticker(sticker.id, 1)}
                        icon={<ArrowDown {...iconProps} />}
                      />
                      <IconButton
                        label="Удалить"
                        disabled={pendingKey === `sticker:delete:${sticker.id}`}
                        onClick={() => deleteSticker(sticker.id)}
                        icon={<Trash2 {...iconProps} />}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );


  return (
    <div className="grid gap-4">
      <section className="premium-panel rounded-[26px] p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="eyebrow-pill">
                <Sticker {...iconProps} />
                Библиотека реакций
              </span>
              <span className="status-pill">
                <Laugh {...iconProps} />
                {viewerRoleLabels[viewer.role] ?? viewer.role}
              </span>
            </div>
            <h1 className="mt-3 text-xl font-semibold tracking-tight text-white">
              Смайлики, GIF и стикеры
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-dim)]">
              Загружайте медиа-реакции, скрывайте или включайте их и сразу
              проверяйте, как библиотека попадает в панель выбора диалогов.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 xl:grid-cols-[auto_minmax(0,1fr)] xl:items-center">
          <div className="flex flex-wrap gap-2">
            <AdminTabButton
              active={activeTab === "emoji"}
              icon={<Laugh {...iconProps} />}
              label="Смайлики"
              onClick={() => setActiveTab("emoji")}
            />
            <AdminTabButton
              active={activeTab === "gif"}
              icon={<Film {...iconProps} />}
              label="GIF"
              onClick={() => setActiveTab("gif")}
            />
            <Link
              href="/app/admin/sticker-packs"
              className="inline-flex h-10 items-center gap-2 rounded-[14px] border border-transparent px-3 text-sm font-medium text-[var(--text-muted)] transition-colors hover:bg-white/[0.05] hover:text-white"
            >
              <Sticker {...iconProps} />
              Наборы стикеров
            </Link>
          </div>

          <label className="flex items-center gap-2 rounded-[16px] border border-white/8 bg-white/[0.03] px-3 text-[var(--text-muted)]">
            <Search size={16} strokeWidth={1.5} className="shrink-0" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Поиск по библиотеке"
              className="h-10 border-0 bg-transparent px-0 text-sm text-white"
            />
          </label>
        </div>

        {error ? <p className="mt-4 text-sm text-rose-200">{error}</p> : null}
        {status ? <p className="mt-2 text-sm text-emerald-200">{status}</p> : null}
      </section>

      {activeTab === "emoji" ? renderEmojiTab() : null}
      {activeTab === "gif" ? renderGifTab() : null}

    </div>
  );
}

function AdminTabButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-[14px] border px-3 text-sm font-medium transition-colors",
        active
          ? "border-white/14 bg-white/[0.08] text-white"
          : "border-transparent bg-transparent text-[var(--text-muted)] hover:bg-white/[0.05] hover:text-white",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2 py-1 text-[10px] font-medium uppercase tracking-[0.14em]",
        active
          ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
          : "border-white/10 bg-white/[0.04] text-[var(--text-muted)]",
      )}
    >
      {active ? "Включено" : "Скрыто"}
    </span>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  icon,
}: {
  label: string;
  disabled: boolean;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void | Promise<void>;
  icon: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(event) => void onClick(event)}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/8 bg-white/[0.04] text-[var(--text-soft)] transition-colors hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
    >
      {icon}
    </button>
  );
}

