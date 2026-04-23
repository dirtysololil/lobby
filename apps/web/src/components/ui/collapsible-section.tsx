"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CollapsibleSectionProps {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  defaultOpen?: boolean;
  description?: string;
  headerClassName?: string;
  kicker?: string;
  summary?: ReactNode;
  title: string;
}

export function CollapsibleSection({
  children,
  className,
  contentClassName,
  defaultOpen = false,
  description,
  headerClassName,
  kicker,
  summary,
  title,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <section
      className={cn(
        "premium-panel overflow-hidden rounded-[22px]",
        className,
      )}
    >
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-3.5",
          open && "border-b border-[var(--border-soft)]",
          headerClassName,
        )}
      >
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-controls={contentId}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] border border-[var(--border-soft)] bg-black text-[var(--text-soft)] transition-transform duration-150">
            <ChevronDown
              size={16}
              strokeWidth={1.7}
              className={cn("transition-transform duration-150", open && "rotate-180")}
            />
          </span>
          <span className="min-w-0">
            {kicker ? <span className="section-kicker">{kicker}</span> : null}
            <span className="mt-1 block truncate text-sm font-semibold tracking-tight text-white">
              {title}
            </span>
            {description ? (
              <span className="mt-1 block text-xs text-[var(--text-dim)]">
                {description}
              </span>
            ) : null}
          </span>
        </button>

        {summary ? <div className="shrink-0">{summary}</div> : null}
      </div>

      {open ? (
        <div id={contentId} className={cn("px-4 py-4", contentClassName)}>
          {children}
        </div>
      ) : null}
    </section>
  );
}
