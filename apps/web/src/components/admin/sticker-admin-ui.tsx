"use client";

import { MoreHorizontal, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface KebabMenuItem {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  destructive?: boolean;
}

export function StatusBadge({
  label,
  tone = "neutral",
  className,
}: {
  label: string;
  tone?: "live" | "neutral" | "warning" | "danger" | "accent";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-full border px-2 text-[10px] font-semibold uppercase tracking-[0.16em]",
        tone === "live" && "border-emerald-400/18 bg-emerald-400/10 text-emerald-100",
        tone === "accent" && "border-[#0070F3]/24 bg-[#0070F3]/12 text-white",
        tone === "warning" && "border-amber-400/18 bg-amber-400/10 text-amber-100",
        tone === "danger" && "border-rose-400/18 bg-rose-400/10 text-rose-100",
        tone === "neutral" && "border-[var(--border-soft)] bg-black text-[var(--text-muted)]",
        className,
      )}
    >
      {label}
    </span>
  );
}

export function ToggleField({
  label,
  checked,
  onChange,
  disabled = false,
  description,
}: {
  label: string;
  checked: boolean;
  onChange: (nextValue: boolean) => void;
  disabled?: boolean;
  description?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-[16px] border border-[var(--border)] bg-black px-3 py-2.5 text-left transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)] disabled:cursor-not-allowed disabled:opacity-50"
    >
      <div className="min-w-0">
        <div className="text-sm font-medium text-white">{label}</div>
        {description ? (
          <div className="mt-0.5 text-xs text-[var(--text-muted)]">{description}</div>
        ) : null}
      </div>
      <span
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 rounded-full border transition-colors",
          checked
            ? "border-[#0070F3]/35 bg-[#0070F3]/22"
            : "border-white/10 bg-[var(--bg-panel-soft)]",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-[0_4px_12px_rgba(0,0,0,0.35)] transition-transform",
            checked ? "translate-x-[18px]" : "translate-x-0.5",
          )}
        />
      </span>
    </button>
  );
}

export function KebabMenu({
  items,
  buttonClassName,
}: {
  items: KebabMenuItem[];
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-[12px] border border-[var(--border-soft)] bg-black text-[var(--text-muted)] transition-colors hover:border-[var(--border)] hover:bg-[var(--bg-hover)] hover:text-white",
          buttonClassName,
        )}
        aria-label="Открыть действия"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+0.4rem)] z-20 min-w-[180px] overflow-hidden rounded-[16px] border border-[var(--border)] bg-black p-1 shadow-[0_22px_56px_rgba(0,0,0,0.55)]">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className={cn(
                "flex w-full items-center rounded-[12px] px-3 py-2 text-left text-sm transition-colors",
                item.destructive
                  ? "text-rose-100 hover:bg-rose-500/10"
                  : "text-[var(--text-soft)] hover:bg-[var(--bg-hover)] hover:text-white",
                item.disabled && "cursor-not-allowed opacity-50",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function DrawerShell({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      const mountFrame = window.requestAnimationFrame(() => {
        setMounted(true);
      });
      const visibleFrame = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setVisible(true));
      });

      return () => {
        window.cancelAnimationFrame(mountFrame);
        window.cancelAnimationFrame(visibleFrame);
      };
    }

    if (!mounted) {
      return;
    }

    const frame = window.requestAnimationFrame(() => setVisible(false));
    const timer = window.setTimeout(() => setMounted(false), 180);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [mounted, open]);

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

  if (!mounted) {
    return null;
  }

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[95] flex justify-end bg-black/82 transition-opacity duration-150",
        visible ? "opacity-100" : "opacity-0",
      )}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      role="presentation"
    >
      <aside
        className={cn(
          "flex h-full w-full max-w-[min(92vw,468px)] flex-col border-l border-[var(--border)] bg-black shadow-[-28px_0_72px_rgba(0,0,0,0.45)] transition-transform duration-200",
          visible ? "translate-x-0" : "translate-x-8",
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border-soft)] px-4 py-4">
          <div className="min-w-0">
            <div className="text-base font-semibold tracking-tight text-white">{title}</div>
            {subtitle ? (
              <div className="mt-1 text-xs text-[var(--text-muted)]">{subtitle}</div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] border border-[var(--border-soft)] bg-black text-[var(--text-soft)] transition-colors hover:border-[var(--border)] hover:bg-[var(--bg-hover)] hover:text-white"
            aria-label="Закрыть"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>

        {footer ? (
          <div className="border-t border-[var(--border-soft)] px-4 py-3">{footer}</div>
        ) : null}
      </aside>
    </div>,
    document.body,
  );
}

export function DrawerActions({
  onClose,
  onSave,
  saveLabel = "Сохранить",
  closeLabel = "Закрыть",
  saving = false,
  saveDisabled = false,
}: {
  onClose: () => void;
  onSave: () => void;
  saveLabel?: string;
  closeLabel?: string;
  saving?: boolean;
  saveDisabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-2">
      <Button type="button" size="sm" variant="ghost" onClick={onClose}>
        {closeLabel}
      </Button>
      <Button
        type="button"
        size="sm"
        onClick={onSave}
        disabled={saving || saveDisabled}
      >
        {saving ? "Сохраняем..." : saveLabel}
      </Button>
    </div>
  );
}
