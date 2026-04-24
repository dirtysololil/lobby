"use client";

import { MoreHorizontal, X } from "lucide-react";
import { createPortal } from "react-dom";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
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
        "inline-flex h-5 items-center rounded-full border bg-black px-2 text-[10px] font-semibold uppercase tracking-[0.14em]",
        tone === "live" && "border-emerald-400/20 text-emerald-100",
        tone === "accent" && "border-[var(--border-strong)] text-white",
        tone === "warning" && "border-amber-400/22 text-amber-100",
        tone === "danger" && "border-rose-400/22 text-rose-100",
        tone === "neutral" && "border-[var(--border-soft)] text-[var(--text-muted)]",
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
      className="flex min-h-11 w-full items-center justify-between gap-3 rounded-[12px] border border-[var(--border)] bg-black px-3 py-2 text-left transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)] disabled:cursor-not-allowed disabled:opacity-50"
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
            ? "border-[var(--border-strong)] bg-[var(--bg-active)]"
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
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const updateMenuPosition = useCallback(() => {
    if (!buttonRef.current) {
      return;
    }

    const viewportPadding = 12;
    const gap = 8;
    const width = 196;
    const rect = buttonRef.current.getBoundingClientRect();
    const left = Math.min(
      Math.max(rect.right - width, viewportPadding),
      window.innerWidth - width - viewportPadding,
    );
    const spaceBelow = window.innerHeight - rect.bottom - gap - viewportPadding;
    const spaceAbove = rect.top - gap - viewportPadding;
    const renderAbove = spaceBelow < 184 && spaceAbove > spaceBelow;

    setMenuStyle(
      renderAbove
        ? {
            left,
            width,
            bottom: Math.max(viewportPadding, window.innerHeight - rect.top + gap),
          }
        : {
            left,
            top: Math.min(rect.bottom + gap, window.innerHeight - viewportPadding),
            width,
          },
    );
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const positionFrame = window.requestAnimationFrame(updateMenuPosition);

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
    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(positionFrame);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, updateMenuPosition]);

  const menu =
    open && menuStyle
      ? createPortal(
          <div
            ref={menuRef}
            className="fixed z-[90] overflow-hidden rounded-[14px] border border-[var(--border)] bg-black p-1 shadow-[0_18px_44px_rgba(0,0,0,0.46)]"
            style={menuStyle}
          >
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
                  "flex min-h-9 w-full items-center rounded-[10px] px-3 py-2 text-left text-sm transition-colors",
                  item.destructive
                    ? "text-rose-100 hover:bg-rose-500/10"
                    : "text-[var(--text-soft)] hover:bg-[var(--bg-hover)] hover:text-white",
                  item.disabled && "cursor-not-allowed opacity-50",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
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
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-[12px] border border-[var(--border-soft)] bg-black text-[var(--text-muted)] transition-colors hover:border-[var(--border)] hover:bg-[var(--bg-hover)] hover:text-white",
          buttonClassName,
        )}
        aria-label="Открыть действия"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {menu}
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
        "fixed inset-0 z-[95] flex justify-end bg-black/80 transition-opacity duration-150",
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
          "flex h-full w-full max-w-[min(92vw,432px)] flex-col border-l border-[var(--border)] bg-black shadow-[-18px_0_48px_rgba(0,0,0,0.36)] transition-transform duration-200",
          visible ? "translate-x-0" : "translate-x-8",
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border-soft)] px-4 py-3.5">
          <div className="min-w-0">
            <div className="text-base font-semibold tracking-normal text-white">{title}</div>
            {subtitle ? (
              <div className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{subtitle}</div>
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
    <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={onClose}
        className="h-10 rounded-[12px] border-white/8 bg-black px-4 hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)]"
      >
        {closeLabel}
      </Button>
      <Button
        type="button"
        size="sm"
        onClick={onSave}
        disabled={saving || saveDisabled}
        className="h-10 rounded-[12px] border-white bg-white px-5 text-black hover:border-white hover:bg-neutral-100"
      >
        {saving ? "Сохраняем..." : saveLabel}
      </Button>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Удалить",
  pending = false,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCancel();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onCancel, open]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 px-4 py-6"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onCancel();
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        className="w-full max-w-[380px] rounded-[18px] border border-[var(--border)] bg-black p-4 shadow-[0_22px_60px_rgba(0,0,0,0.52)]"
      >
        <p className="section-kicker">Подтверждение</p>
        <h3 className="mt-2 text-base font-semibold tracking-normal text-white">
          {title}
        </h3>
        <p className="mt-2 text-sm leading-5 text-[var(--text-dim)]">
          {description}
        </p>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={pending}
            className="h-10 rounded-[12px] border-white/8 bg-black hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)]"
          >
            Отмена
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={pending}
            className="h-10 rounded-[12px] border-rose-400/25 bg-black text-rose-100 hover:border-rose-400/40 hover:bg-rose-500/10"
          >
            {pending ? "Удаляем..." : confirmLabel}
          </Button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
