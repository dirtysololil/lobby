"use client";

import { SmilePlus, Star, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const verificationStatusValue = "✦";

const statusOptions: Array<{
  className?: string;
  content: ReactNode;
  label: string;
  value: string;
}> = [
  {
    value: verificationStatusValue,
    label: "Верификация",
    content: (
      <Star
        size={19}
        strokeWidth={2}
        className="fill-[#3b82f6] text-[#3b82f6]"
      />
    ),
    className: "text-[#3b82f6]",
  },
  ...[
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
  ].map((emoji) => ({
    value: emoji,
    label: emoji,
    content: <span className="leading-none">{emoji}</span>,
  })),
];

function buildMenuPosition(trigger: HTMLButtonElement): CSSProperties {
  const viewportPadding = 12;
  const gap = 8;
  const width = 220;
  const rect = trigger.getBoundingClientRect();
  const left = Math.min(
    Math.max(rect.left, viewportPadding),
    window.innerWidth - width - viewportPadding,
  );
  const spaceBelow = window.innerHeight - rect.bottom - gap - viewportPadding;
  const spaceAbove = rect.top - gap - viewportPadding;
  const renderAbove = spaceBelow < 232 && spaceAbove > spaceBelow;

  return renderAbove
    ? {
        left,
        width,
        bottom: Math.max(viewportPadding, window.innerHeight - rect.top + gap),
      }
    : {
        left,
        top: Math.min(rect.bottom + gap, window.innerHeight - viewportPadding),
        width,
      };
}

interface ProfileEmojiPickerProps {
  onChange: (value: string | null) => void;
  value: string | null | undefined;
}

function StatusValue({ value }: { value: string }) {
  if (value === verificationStatusValue) {
    return (
      <Star
        size={18}
        strokeWidth={2}
        className="fill-[#3b82f6] text-[#3b82f6]"
      />
    );
  }

  return <span className="leading-none">{value}</span>;
}

export function ProfileEmojiPicker({
  onChange,
  value,
}: ProfileEmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const portalRoot = typeof document === "undefined" ? null : document.body;

  const updateMenuPosition = useCallback(() => {
    if (!buttonRef.current) {
      return;
    }

    setMenuStyle(buildMenuPosition(buttonRef.current));
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    updateMenuPosition();

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;

      if (
        rootRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }

      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }

    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, updateMenuPosition]);

  const menu =
    open && portalRoot && menuStyle
      ? createPortal(
          <div
            ref={menuRef}
            className="fixed z-[80] w-[220px] rounded-[18px] border border-[var(--border)] bg-[var(--bg-panel)] p-3 shadow-[0_18px_44px_rgba(0,0,0,0.42)]"
            style={menuStyle}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
                Статус
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
              {statusOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex h-10 items-center justify-center rounded-[12px] border border-white/8 bg-black text-xl transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)]",
                    option.className,
                    value === option.value &&
                      "border-[var(--border-strong)] bg-[var(--bg-active)]",
                  )}
                  aria-label={option.label}
                >
                  {option.content}
                </button>
              ))}
            </div>
          </div>,
          portalRoot,
        )
      : null;

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          setOpen((current) => {
            const nextOpen = !current;

            if (nextOpen) {
              requestAnimationFrame(() => updateMenuPosition());
            }

            return nextOpen;
          });
        }}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-white/8 bg-black text-lg transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        aria-label="Выбрать смайлик статуса"
        aria-expanded={open}
      >
        {value ? (
          <StatusValue value={value} />
        ) : (
          <SmilePlus
            size={17}
            strokeWidth={1.7}
            className="text-[var(--text-soft)]"
          />
        )}
      </button>

      {menu}
    </div>
  );
}
