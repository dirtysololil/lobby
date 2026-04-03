import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-[18px] border text-sm font-semibold tracking-[-0.01em] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[linear-gradient(135deg,#8ff0ea_0%,#74d3cd_54%,#8ea7ff_100%)] text-[#041014] shadow-[0_16px_34px_rgba(124,215,209,0.24)] hover:-translate-y-[1px] hover:brightness-105",
        secondary:
          "border-[var(--border)] bg-white/[0.04] text-[var(--text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:border-[var(--border-strong)] hover:bg-white/[0.08]",
        ghost:
          "border-transparent bg-transparent text-[var(--text-dim)] hover:bg-white/[0.05] hover:text-[var(--text)]",
        destructive:
          "border-transparent bg-[linear-gradient(135deg,#ff9bb1,#ff798f)] text-[#230812] shadow-[0_12px_26px_rgba(255,122,147,0.26)] hover:-translate-y-[1px] hover:brightness-105",
      },
      size: {
        default: "min-h-[44px] px-[18px]",
        sm: "min-h-[34px] px-3 text-xs",
        lg: "min-h-[50px] px-[22px] text-base",
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
