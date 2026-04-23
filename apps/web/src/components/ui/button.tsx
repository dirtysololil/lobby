import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-[12px] border text-sm font-medium tracking-tight shadow-none transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "border-[#0070F3] bg-[#0070F3] text-white hover:border-[#0064d8] hover:bg-[#0064d8]",
        secondary:
          "border-[var(--border)] bg-black text-white hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)]",
        ghost:
          "border-transparent bg-transparent text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-white",
        destructive:
          "border-red-500/40 bg-red-950/40 text-red-50 hover:border-red-400/60 hover:bg-red-950/60",
      },
      size: {
        default: "h-10 px-4 text-sm",
        sm: "h-8 px-3 text-xs",
        lg: "h-11 px-4 text-sm",
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
