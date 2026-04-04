"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type SelectFieldProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  shellClassName?: string;
};

const SelectField = React.forwardRef<HTMLSelectElement, SelectFieldProps>(
  ({ className, shellClassName, children, ...props }, ref) => {
    return (
      <div
        className={cn(
          "relative flex min-h-10 items-center rounded-[14px] border border-[var(--border)] bg-[rgba(255,255,255,0.045)] shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] transition-colors duration-150 hover:border-[var(--border-strong)] hover:bg-[rgba(255,255,255,0.06)]",
          shellClassName,
        )}
      >
        <select
          ref={ref}
          className={cn(
            "field-select h-10 border-0 bg-none pl-3.5 pr-10 text-sm shadow-none focus-visible:ring-0",
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 h-4 w-4 text-[var(--text-muted)]"
          strokeWidth={1.6}
        />
      </div>
    );
  },
);

SelectField.displayName = "SelectField";

export { SelectField };
