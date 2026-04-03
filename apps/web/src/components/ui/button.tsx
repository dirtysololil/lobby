import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-2xl border text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/70 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-gradient-to-r from-[#7dd4ff] to-[#90b0ff] text-[#0a1020] shadow-[0_8px_24px_rgba(98,177,255,0.45)] hover:brightness-105",
        secondary:
          "border-[var(--border)] bg-[var(--surface-soft)] text-[var(--text)] hover:border-[var(--border-strong)] hover:bg-white/[0.1]",
        ghost: "border-transparent text-[var(--text-dim)] hover:bg-white/[0.05] hover:text-[var(--text)]",
        destructive: "border-transparent bg-[#ff6f8f] text-[#1f0b12] hover:bg-[#ff8aa2]",
      },
      size: {
        default: "h-11 px-5",
        sm: "h-9 px-3.5 text-xs",
        lg: "h-12 px-6 text-base",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, size, variant, ...props }, ref) => {
  return <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
});

Button.displayName = "Button";

export { Button, buttonVariants };
