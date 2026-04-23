"use client";

import { SmilePlus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const emojiOptions = [
  "😀",
  "😎",
  "🙂",
  "😉",
  "🥶",
  "😴",
  "🤝",
  "🫡",
  "🎧",
  "🎮",
  "☕",
  "🔥",
  "✨",
  "🚀",
  "❤️",
  "👀",
];

interface ProfileEmojiPickerProps {
  onChange: (value: string | null) => void;
  value: string | null | undefined;
}

export function ProfileEmojiPicker({
  onChange,
  value,
}: ProfileEmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;

      if (!rootRef.current?.contains(target)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-white/8 bg-black text-lg transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        aria-label="Выбрать смайлик статуса"
        aria-expanded={open}
      >
        {value ? (
          <span className="leading-none">{value}</span>
        ) : (
          <SmilePlus size={17} strokeWidth={1.7} className="text-[var(--text-soft)]" />
        )}
      </button>

      {open ? (
        <div className="absolute left-0 top-[calc(100%+8px)] z-20 w-[220px] rounded-[18px] border border-[var(--border)] bg-[var(--bg-panel)] p-3 shadow-[0_18px_44px_rgba(0,0,0,0.42)]">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
              Статус-смайлик
            </p>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className="h-7 rounded-[10px] px-2 text-[11px]"
            >
              <X size={13} strokeWidth={1.8} />
              Сбросить
            </Button>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {emojiOptions.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onChange(emoji);
                  setOpen(false);
                }}
                className={cn(
                  "flex h-10 items-center justify-center rounded-[12px] border border-white/8 bg-black text-xl transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)]",
                  value === emoji && "border-[var(--border-strong)] bg-[var(--bg-active)]",
                )}
              >
                <span className="leading-none">{emoji}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
