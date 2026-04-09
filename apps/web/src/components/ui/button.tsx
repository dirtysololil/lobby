import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border text-sm font-medium tracking-tight shadow-none transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)]",
        secondary:
          "border-white/5 bg-white/10 text-white hover:bg-white/15",
        ghost:
          "border-transparent bg-transparent text-[var(--text-muted)] hover:bg-white/5 hover:text-white",
        destructive:
          "border-red-500/45 bg-[#ff0033] text-white shadow-[0_0_0_1px_rgba(255,0,51,0.14),0_12px_28px_rgba(255,0,51,0.18)] hover:border-red-400/60 hover:bg-[#ff1f4b]",
      },
      size: {
        default: "h-9 px-4 text-sm",
        sm: "h-8 px-3 text-xs",
        lg: "h-9 px-4 text-sm",
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
