"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type SelectOption = {
  value: string;
  label: React.ReactNode;
  disabled: boolean;
};

export type SelectFieldProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  shellClassName?: string;
  listClassName?: string;
};

function flattenOptions(children: React.ReactNode): SelectOption[] {
  return React.Children.toArray(children).flatMap((child) => {
    if (
      !React.isValidElement<{
        children?: React.ReactNode;
        value?: string | number;
        disabled?: boolean;
      }>(child)
    ) {
      return [];
    }

    if (child.type === React.Fragment) {
      return flattenOptions(child.props.children);
    }

    if (typeof child.type === "string" && child.type.toLowerCase() === "option") {
      return [
        {
          value: String(child.props.value ?? ""),
          label: child.props.children,
          disabled: Boolean(child.props.disabled),
        },
      ];
    }

    return [];
  });
}

function buildMenuPosition(trigger: HTMLButtonElement): React.CSSProperties {
  const viewportPadding = 12;
  const gap = 8;
  const rect = trigger.getBoundingClientRect();
  const maxWidth = Math.max(220, window.innerWidth - viewportPadding * 2);
  const width = Math.min(Math.max(rect.width, 220), maxWidth);
  const left = Math.min(
    Math.max(rect.left, viewportPadding),
    window.innerWidth - width - viewportPadding,
  );
  const spaceBelow = window.innerHeight - rect.bottom - gap - viewportPadding;
  const spaceAbove = rect.top - gap - viewportPadding;
  const renderAbove = spaceBelow < 180 && spaceAbove > spaceBelow;
  const maxHeight = Math.max(144, Math.min(320, renderAbove ? spaceAbove : spaceBelow));

  return renderAbove
    ? {
        left,
        width,
        bottom: Math.max(viewportPadding, window.innerHeight - rect.top + gap),
        maxHeight,
      }
    : {
        left,
        top: Math.min(rect.bottom + gap, window.innerHeight - viewportPadding),
        width,
        maxHeight,
      };
}

const SelectField = React.forwardRef<HTMLSelectElement, SelectFieldProps>(
  (
    {
      className,
      shellClassName,
      listClassName,
      children,
      value,
      defaultValue,
      disabled,
      onChange,
      onBlur,
      name,
      id,
      required,
      ...props
    },
    ref,
  ) => {
    const options = React.useMemo(() => flattenOptions(children), [children]);
    const isControlled = value !== undefined;
    const initialValue = React.useMemo(() => {
      if (value !== undefined) {
        return String(value);
      }

      if (defaultValue !== undefined) {
        return String(defaultValue);
      }

      return options[0]?.value ?? "";
    }, [defaultValue, options, value]);
    const [internalValue, setInternalValue] = React.useState(initialValue);
    const [open, setOpen] = React.useState(false);
    const [menuStyle, setMenuStyle] = React.useState<React.CSSProperties | null>(null);
    const [portalRoot, setPortalRoot] = React.useState<HTMLElement | null>(null);
    const containerRef = React.useRef<HTMLDivElement | null>(null);
    const buttonRef = React.useRef<HTMLButtonElement | null>(null);
    const listRef = React.useRef<HTMLDivElement | null>(null);
    const selectRef = React.useRef<HTMLSelectElement | null>(null);
    const currentValue = isControlled ? String(value ?? "") : internalValue;
    const selectedOption =
      options.find((option) => option.value === currentValue) ?? options[0] ?? null;

    React.useEffect(() => {
      setPortalRoot(document.body);
    }, []);

    React.useEffect(() => {
      if (!isControlled) {
        setInternalValue(initialValue);
      }
    }, [initialValue, isControlled]);

    const updateMenuPosition = React.useCallback(() => {
      if (!buttonRef.current) {
        return;
      }

      setMenuStyle(buildMenuPosition(buttonRef.current));
    }, []);

    React.useEffect(() => {
      if (!open) {
        return;
      }

      updateMenuPosition();

      function handlePointerDown(event: MouseEvent) {
        const target = event.target as Node;

        if (
          containerRef.current?.contains(target) ||
          listRef.current?.contains(target)
        ) {
          return;
        }

        setOpen(false);
        onBlur?.(event as unknown as React.FocusEvent<HTMLSelectElement>);
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
    }, [onBlur, open, updateMenuPosition]);

    const setRefs = React.useCallback(
      (node: HTMLSelectElement | null) => {
        selectRef.current = node;

        if (typeof ref === "function") {
          ref(node);
          return;
        }

        if (ref) {
          ref.current = node;
        }
      },
      [ref],
    );

    function commitValue(nextValue: string) {
      if (!isControlled) {
        setInternalValue(nextValue);
      }

      if (selectRef.current) {
        selectRef.current.value = nextValue;
        selectRef.current.dispatchEvent(new Event("change", { bubbles: true }));
      } else {
        onChange?.({
          target: { value: nextValue, name },
          currentTarget: { value: nextValue, name },
        } as unknown as React.ChangeEvent<HTMLSelectElement>);
      }

      setOpen(false);
      buttonRef.current?.focus();
    }

    const listboxId = id ? `${id}-listbox` : undefined;
    const portalMenu =
      open && portalRoot && menuStyle
        ? createPortal(
            <div
              ref={listRef}
              className={cn(
                "select-portal-layer overflow-hidden rounded-[16px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent_22%),rgba(11,16,24,0.98)] p-1 shadow-[0_18px_40px_rgba(4,8,16,0.46)] backdrop-blur-xl",
                listClassName,
              )}
              style={menuStyle}
            >
              <div
                id={listboxId}
                role="listbox"
                aria-labelledby={id ? `${id}-trigger` : undefined}
                className="grid gap-1 overflow-y-auto"
                style={{ maxHeight: menuStyle.maxHeight }}
              >
                {options.map((option) => {
                  const active = option.value === currentValue;

                  return (
                    <button
                      key={`${name ?? id ?? "select"}-${option.value}`}
                      type="button"
                      role="option"
                      aria-selected={active}
                      disabled={option.disabled}
                      onClick={() => commitValue(option.value)}
                      className={cn(
                        "flex min-h-9 w-full items-center justify-between gap-3 rounded-[12px] px-3 py-2 text-left text-sm transition-colors",
                        active
                          ? "bg-[var(--bg-active)] text-white"
                          : "text-[var(--text-soft)] hover:bg-white/[0.06] hover:text-white",
                        option.disabled && "cursor-not-allowed opacity-50",
                      )}
                    >
                      <span className="min-w-0 truncate">{option.label}</span>
                      {active ? <Check className="h-4 w-4 text-[var(--accent-strong)]" /> : null}
                    </button>
                  );
                })}
              </div>
            </div>,
            portalRoot,
          )
        : null;

    return (
      <>
        <div ref={containerRef} className={cn("relative", shellClassName)}>
          <select
            {...props}
            ref={setRefs}
            id={id}
            name={name}
            value={currentValue}
            defaultValue={isControlled ? undefined : defaultValue}
            required={required}
            disabled={disabled}
            onChange={onChange}
            onBlur={onBlur}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
          >
            {children}
          </select>

          <button
            ref={buttonRef}
            id={id ? `${id}-trigger` : undefined}
            type="button"
            disabled={disabled}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={listboxId}
            onClick={() => {
              const nextOpen = !open;
              setOpen(nextOpen);

              if (!nextOpen) {
                return;
              }

              requestAnimationFrame(() => {
                updateMenuPosition();
              });
            }}
            className={cn(
              "flex min-h-10 w-full items-center justify-between gap-2 rounded-[14px] border border-[var(--border)] bg-[rgba(255,255,255,0.045)] px-3.5 text-left text-sm text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] transition-colors duration-150 hover:border-[var(--border-strong)] hover:bg-[rgba(255,255,255,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-60",
              className,
            )}
          >
            <span className="min-w-0 truncate">
              {selectedOption?.label ?? (
                <span className="text-[var(--text-muted)]">Выберите</span>
              )}
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform",
                open && "rotate-180",
              )}
              strokeWidth={1.6}
            />
          </button>
        </div>

        {portalMenu}
      </>
    );
  },
);

SelectField.displayName = "SelectField";

export { SelectField };
