import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-[20px] border text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[linear-gradient(135deg,#9bc7ff_0%,#83b5ff_52%,#a18dff_100%)] text-[#05101f] shadow-[0_16px_34px_rgba(95,141,255,0.35)] hover:-translate-y-[1px] hover:brightness-105",
        secondary:
          "border-[var(--border)] bg-white/[0.04] text-[var(--text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:border-[var(--border-strong)] hover:bg-white/[0.08]",
        ghost:
          "border-transparent bg-transparent text-[var(--text-dim)] hover:bg-white/[0.05] hover:text-[var(--text)]",
        destructive:
          "border-transparent bg-[linear-gradient(135deg,#ff88a6,#ff6f8f)] text-[#240812] shadow-[0_12px_26px_rgba(255,111,143,0.28)] hover:-translate-y-[1px] hover:brightness-105",
      },
      size: {
        default: "min-h-[48px] px-5",
        sm: "min-h-[38px] px-3.5 text-xs",
        lg: "min-h-[54px] px-6 text-base",
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
