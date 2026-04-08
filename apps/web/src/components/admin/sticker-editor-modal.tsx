"use client";

/* eslint-disable @next/next/no-img-element */
import { LoaderCircle, Minus, Move, Plus, UploadCloud, X } from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface StickerEditorDraft {
  file: File;
  title: string;
  keywords: string[];
  crop: {
    scale: number;
    translateX: number;
    translateY: number;
  };
  published: boolean;
}

interface StickerEditorModalProps {
  open: boolean;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (draft: StickerEditorDraft) => Promise<void>;
}

const previewSize = 224;

export function StickerEditorModal({
  open,
  pending,
  error,
  onClose,
  onSubmit,
}: StickerEditorModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [keywords, setKeywords] = useState("");
  const [published, setPublished] = useState(true);
  const [crop, setCrop] = useState({
    scale: 1,
    translateX: 0,
    translateY: 0,
  });
  const [dragOrigin, setDragOrigin] = useState<{
    pointerX: number;
    pointerY: number;
    startX: number;
    startY: number;
  } | null>(null);
  const previewUrl = useMemo(
    () => (file ? URL.createObjectURL(file) : null),
    [file],
  );
  const isVideo = Boolean(file && file.type.startsWith("video/"));
  const mediaRef = useRef<HTMLVideoElement | HTMLImageElement | null>(null);

  useEffect(() => {
    if (!previewUrl) {
      return;
    }

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setTitle("");
      setKeywords("");
      setPublished(true);
      setCrop({
        scale: 1,
        translateX: 0,
        translateY: 0,
      });
    }
  }, [open]);

  if (!open) {
    return null;
  }

  async function handleSubmit() {
    if (!file) {
      return;
    }

    await onSubmit({
      file,
      title: title.trim(),
      keywords: keywords
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      crop,
      published,
    });
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!file || pending) {
      return;
    }

    setDragOrigin({
      pointerX: event.clientX,
      pointerY: event.clientY,
      startX: crop.translateX,
      startY: crop.translateY,
    });
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragOrigin) {
      return;
    }

    setCrop((current) => ({
      ...current,
      translateX: dragOrigin.startX + (event.clientX - dragOrigin.pointerX),
      translateY: dragOrigin.startY + (event.clientY - dragOrigin.pointerY),
    }));
  }

  function handlePointerUp() {
    setDragOrigin(null);
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[rgba(4,8,14,0.72)] px-3 py-6 backdrop-blur-sm">
      <div className="w-full max-w-[960px] rounded-[26px] border border-white/10 bg-[#091019] shadow-[0_34px_90px_rgba(2,6,12,0.72)]">
        <div className="flex items-center justify-between gap-3 border-b border-white/8 px-5 py-4">
          <div>
            <p className="text-sm font-medium text-white">Добавить стикер</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              224x224 canvas, safe area и живой preview для animated файлов.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/8 bg-white/[0.04] text-[var(--text-soft)] transition-colors hover:bg-white/[0.08] hover:text-white"
            aria-label="Закрыть редактор"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        <div className="grid gap-5 p-5 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="grid gap-4">
            <label className="grid min-h-40 cursor-pointer place-items-center rounded-[22px] border border-dashed border-white/12 bg-white/[0.03] px-4 py-5 text-center">
              <div>
                <UploadCloud size={22} strokeWidth={1.5} className="mx-auto text-[var(--text-soft)]" />
                <p className="mt-3 text-sm text-white">
                  {file ? file.name : "PNG, JPG, WEBP, GIF, MP4, WEBM"}
                </p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Выберите исходник и сразу подгоните его в safe area.
                </p>
              </div>
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,video/mp4,video/webm"
                className="hidden"
                onChange={(event) => {
                  const nextFile = event.target.files?.[0] ?? null;
                  setFile(nextFile);
                  setTitle(
                    nextFile?.name.replace(/\.[^.]+$/, "").trim().slice(0, 80) ?? "",
                  );
                  setCrop({
                    scale: 1,
                    translateX: 0,
                    translateY: 0,
                  });
                }}
              />
            </label>

            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Название стикера"
              className="h-11 border-white/8 bg-white/[0.03] text-white"
            />

            <Input
              value={keywords}
              onChange={(event) => setKeywords(event.target.value)}
              placeholder="Ключевые слова через запятую"
              className="h-11 border-white/8 bg-white/[0.03] text-white"
            />

            <label className="flex items-center justify-between rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white">
              Опубликовать сразу
              <input
                type="checkbox"
                checked={published}
                onChange={(event) => setPublished(event.target.checked)}
                className="h-4 w-4 rounded border-white/10 bg-transparent"
              />
            </label>

            <div className="grid gap-2 rounded-[18px] border border-white/8 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  Масштаб
                </span>
                <span className="text-xs text-white">{crop.scale.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min={0.6}
                max={3.5}
                step={0.01}
                value={crop.scale}
                onChange={(event) =>
                  setCrop((current) => ({
                    ...current,
                    scale: Number(event.target.value),
                  }))
                }
              />
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-9 flex-1"
                  onClick={() =>
                    setCrop((current) => ({
                      ...current,
                      scale: Math.max(0.6, Number((current.scale - 0.08).toFixed(2))),
                    }))
                  }
                >
                  <Minus size={14} strokeWidth={1.5} />
                  Уменьшить
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-9 flex-1"
                  onClick={() =>
                    setCrop((current) => ({
                      ...current,
                      scale: Math.min(3.5, Number((current.scale + 0.08).toFixed(2))),
                    }))
                  }
                >
                  <Plus size={14} strokeWidth={1.5} />
                  Увеличить
                </Button>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-9"
                onClick={() =>
                  setCrop({
                    scale: 1,
                    translateX: 0,
                    translateY: 0,
                  })
                }
              >
                <Move size={14} strokeWidth={1.5} />
                Сбросить позицию
              </Button>
            </div>
          </aside>

          <section className="grid gap-4">
            <div className="rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] p-4">
              <div
                className="group relative mx-auto overflow-hidden rounded-[24px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(106,168,248,0.12),transparent_60%),rgba(255,255,255,0.03)]"
                style={{ width: previewSize, height: previewSize }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
              >
                {previewUrl ? (
                  isVideo ? (
                    <video
                      ref={(node) => {
                        mediaRef.current = node;
                      }}
                      src={previewUrl}
                      autoPlay
                      muted
                      loop
                      playsInline
                      className="absolute left-1/2 top-1/2 max-w-none object-contain"
                      style={{
                        transform: `translate(calc(-50% + ${crop.translateX}px), calc(-50% + ${crop.translateY}px)) scale(${crop.scale})`,
                      }}
                    />
                  ) : (
                    <img
                      ref={(node) => {
                        mediaRef.current = node;
                      }}
                      src={previewUrl}
                      alt={title || "Стикер"}
                      className="absolute left-1/2 top-1/2 max-w-none object-contain"
                      style={{
                        transform: `translate(calc(-50% + ${crop.translateX}px), calc(-50% + ${crop.translateY}px)) scale(${crop.scale})`,
                      }}
                      draggable={false}
                    />
                  )
                ) : (
                  <div className="grid h-full place-items-center text-center text-sm text-[var(--text-muted)]">
                    Добавьте файл, чтобы увидеть редактор.
                  </div>
                )}

                <div className="pointer-events-none absolute inset-0 border border-white/8" />
                <div className="pointer-events-none absolute inset-[18px] rounded-[18px] border border-dashed border-white/12" />
                <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-white/8" />
                <div className="pointer-events-none absolute inset-y-0 left-1/2 border-l border-white/8" />
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
                <span className="rounded-full border border-white/8 bg-white/[0.04] px-2 py-1">
                  Canvas 224x224
                </span>
                <span className="rounded-full border border-white/8 bg-white/[0.04] px-2 py-1">
                  Safe area
                </span>
                <span className="rounded-full border border-white/8 bg-white/[0.04] px-2 py-1">
                  Animated preview
                </span>
              </div>
            </div>

            {error ? (
              <div className="rounded-[18px] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                {error}
              </div>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" className="h-10 px-4" onClick={onClose}>
                Отмена
              </Button>
              <Button
                type="button"
                className={cn("h-10 px-4", pending && "pointer-events-none")}
                disabled={!file || pending || !title.trim()}
                onClick={() => void handleSubmit()}
              >
                {pending ? (
                  <>
                    <LoaderCircle size={16} strokeWidth={1.5} className="animate-spin" />
                    Сохраняем...
                  </>
                ) : (
                  "Готово"
                )}
              </Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
