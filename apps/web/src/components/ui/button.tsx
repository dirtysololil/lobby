import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-[12px] border text-sm font-semibold tracking-[-0.01em] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[var(--accent)] text-[#170d08] shadow-[0_6px_18px_rgba(255,123,82,0.18)] hover:-translate-y-[1px] hover:brightness-105",
        secondary:
          "border-[var(--border)] bg-white/[0.04] text-[var(--text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:border-[var(--border-strong)] hover:bg-white/[0.06]",
        ghost:
          "border-transparent bg-transparent text-[var(--text-dim)] hover:bg-white/[0.05] hover:text-[var(--text)]",
        destructive:
          "border-transparent bg-[var(--danger)] text-[#21080c] shadow-[0_6px_18px_rgba(255,110,121,0.16)] hover:-translate-y-[1px] hover:brightness-105",
      },
      size: {
        default: "min-h-[36px] px-3.5",
        sm: "min-h-[28px] px-2.5 text-xs",
        lg: "min-h-[40px] px-4.5 text-base",
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
