import Link, { type LinkProps } from "next/link";
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  HTMLAttributes,
  ReactNode,
} from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const rowVariants = cva(
  "group relative flex w-full min-w-0 items-center gap-3 border-b border-[var(--border-soft)] px-3 py-2.5 text-left transition-colors duration-150 last:border-b-0",
  {
    variants: {
      active: {
        true: "border-[var(--border-strong)] bg-[var(--bg-active)] text-white",
        false: "text-[var(--text-dim)] hover:bg-[var(--surface-3)] hover:text-white",
      },
      unread: {
        true: "before:absolute before:inset-y-2 before:left-0 before:w-[2px] before:rounded-full before:bg-white",
        false: "",
      },
      compact: {
        true: "min-h-11 py-2",
        false: "min-h-[52px]",
      },
    },
    defaultVariants: {
      active: false,
      unread: false,
      compact: false,
    },
  },
);

type RowVariantProps = VariantProps<typeof rowVariants>;

type CompactListLinkProps = RowVariantProps &
  LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps | "className"> & {
    className?: string;
  };

type CompactListButtonProps = RowVariantProps &
  ButtonHTMLAttributes<HTMLButtonElement>;

type CompactListRowProps = RowVariantProps & HTMLAttributes<HTMLDivElement>;

export function CompactList({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col", className)} {...props} />;
}

export function CompactListHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-3 py-2 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--text-muted)]",
        className,
      )}
      {...props}
    />
  );
}

export function CompactListCount({
  className,
  children,
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex min-h-5 items-center rounded-full border border-[var(--border-soft)] bg-[var(--surface-2)] px-2 text-[11px] font-medium normal-case tracking-normal text-[var(--text-dim)]",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function CompactListMeta({
  className,
  children,
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-[var(--border-soft)] bg-black px-2 py-1 text-[11px] font-medium text-[var(--text-dim)]",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function CompactListRow({
  className,
  active,
  unread,
  compact,
  ...props
}: CompactListRowProps) {
  return (
    <div className={cn(rowVariants({ active, unread, compact }), className)} {...props} />
  );
}

export function CompactListLink({
  className,
  active,
  unread,
  compact,
  ...props
}: CompactListLinkProps) {
  return (
    <Link
      className={cn(rowVariants({ active, unread, compact }), className)}
      {...props}
    />
  );
}

export function CompactListButton({
  className,
  active,
  unread,
  compact,
  type = "button",
  ...props
}: CompactListButtonProps) {
  return (
    <button
      type={type}
      className={cn(rowVariants({ active, unread, compact }), className)}
      {...props}
    />
  );
}

export function CompactListAvatarSlot({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center", className)}>
      {children}
    </div>
  );
}
