import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-[10px] border text-sm font-semibold tracking-[-0.01em] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[var(--accent)] text-white hover:brightness-105",
        secondary:
          "border-[var(--border)] bg-[var(--bg-panel-soft)] text-[var(--text)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-panel-muted)]",
        ghost:
          "border-transparent bg-transparent text-[var(--text-dim)] hover:bg-[var(--bg-panel-soft)] hover:text-[var(--text)]",
        destructive:
          "border-transparent bg-[var(--danger)] text-white hover:brightness-105",
      },
      size: {
        default: "min-h-[34px] px-3",
        sm: "min-h-[28px] px-2.5 text-xs",
        lg: "min-h-[38px] px-4 text-base",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, size, variant, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";

export { Button, buttonVariants };
