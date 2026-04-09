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
  const toneClasses = {
    live: {
      shell:
        "border-[color:rgba(34,197,139,0.22)] bg-[linear-gradient(180deg,rgba(34,197,139,0.18),rgba(34,197,139,0.08))] text-emerald-50",
      dot: "bg-emerald-300 shadow-[0_0_0_6px_rgba(34,197,139,0.14)]",
    },
    accent: {
      shell:
        "border-[color:rgba(77,141,255,0.24)] bg-[linear-gradient(180deg,rgba(77,141,255,0.18),rgba(77,141,255,0.08))] text-sky-50",
      dot: "bg-sky-300 shadow-[0_0_0_6px_rgba(77,141,255,0.16)]",
    },
    warning: {
      shell:
        "border-[color:rgba(245,158,11,0.2)] bg-[linear-gradient(180deg,rgba(245,158,11,0.16),rgba(245,158,11,0.08))] text-amber-50",
      dot: "bg-amber-300 shadow-[0_0_0_6px_rgba(245,158,11,0.14)]",
    },
    danger: {
      shell:
        "border-[color:rgba(251,113,133,0.2)] bg-[linear-gradient(180deg,rgba(251,113,133,0.16),rgba(251,113,133,0.08))] text-rose-50",
      dot: "bg-rose-300 shadow-[0_0_0_6px_rgba(251,113,133,0.14)]",
    },
    neutral: {
      shell:
        "border-[color:var(--sw-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] text-[color:var(--sw-text-muted)]",
      dot: "bg-slate-300/80 shadow-[0_0_0_6px_rgba(145,170,210,0.1)]",
    },
  } as const;

  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center gap-1.5 rounded-full border px-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
        toneClasses[tone].shell,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", toneClasses[tone].dot)} />
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
      className="flex w-full items-center justify-between gap-3 rounded-[20px] border border-[color:var(--sw-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] px-3.5 py-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-[border-color,background,transform] duration-200 hover:border-[color:var(--sw-border-strong)] hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-50"
    >
      <div className="min-w-0">
        <div className="text-sm font-medium text-[color:var(--sw-text)]">{label}</div>
        {description ? (
          <div className="mt-0.5 text-xs text-[color:var(--sw-text-muted)]">{description}</div>
        ) : null}
      </div>
      <span
        className={cn(
          "relative inline-flex h-6 w-10 shrink-0 rounded-full border shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors",
          checked
            ? "border-[color:rgba(34,197,139,0.28)] bg-[linear-gradient(180deg,rgba(34,197,139,0.28),rgba(34,197,139,0.16))]"
            : "border-[color:var(--sw-border)] bg-white/[0.06]",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4.5 w-4.5 rounded-full bg-white shadow-[0_8px_18px_rgba(0,0,0,0.32)] transition-transform",
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
          "inline-flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--sw-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] text-[color:var(--sw-text-muted)] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-[border-color,background,color,transform,box-shadow] duration-200 hover:-translate-y-[1px] hover:border-[color:var(--sw-border-strong)] hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] hover:text-[color:var(--sw-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sw-focus)]",
          buttonClassName,
        )}
        aria-label="Открыть действия"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+0.55rem)] z-20 min-w-[196px] overflow-hidden rounded-[20px] border border-[color:var(--sw-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent_24%),rgba(7,12,18,0.96)] p-1.5 shadow-[var(--sw-shadow-panel)] backdrop-blur-xl">
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
                "flex w-full items-center rounded-[14px] px-3 py-2.5 text-left text-sm transition-[background,color,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sw-focus)]",
                item.destructive
                  ? "text-rose-100 hover:bg-rose-500/10"
                  : "text-[color:var(--sw-text-secondary)] hover:bg-white/[0.06] hover:text-[color:var(--sw-text)]",
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
  useEffect(() => {
    if (!open) {
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
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[95] flex justify-end bg-[rgba(2,4,10,0.72)] backdrop-blur-md transition-opacity duration-150 opacity-100"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      role="presentation"
    >
      <aside
        className="relative flex h-full w-full max-w-[min(92vw,480px)] flex-col border-l border-[color:var(--sw-border)] bg-[radial-gradient(circle_at_top_right,rgba(77,141,255,0.12),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.05),transparent_22%),rgba(7,12,18,0.98)] shadow-[-28px_0_72px_rgba(2,6,12,0.45)] transition-transform duration-200 translate-x-0"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(145,170,210,0.5),transparent)]" />

        <div className="flex items-start justify-between gap-4 border-b border-[color:var(--sw-border-soft)] px-4 py-4">
          <div className="min-w-0">
            <div className="text-base font-semibold tracking-tight text-[color:var(--sw-text)]">
              {title}
            </div>
            {subtitle ? (
              <div className="mt-1 text-xs text-[color:var(--sw-text-muted)]">{subtitle}</div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[color:var(--sw-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] text-[color:var(--sw-text-secondary)] transition-[border-color,background,color] duration-150 hover:border-[color:var(--sw-border-strong)] hover:bg-white/[0.08] hover:text-[color:var(--sw-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sw-focus)]"
            aria-label="Закрыть"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>

        {footer ? (
          <div className="border-t border-[color:var(--sw-border-soft)] px-4 py-3">{footer}</div>
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
