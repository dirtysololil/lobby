"use client";

/* eslint-disable @next/next/no-img-element */
import type { PublicUser } from "@lobby/shared";
import { X } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import { getAvatarInitials, getAvatarUrl } from "@/lib/avatar";
import { cn } from "@/lib/utils";

interface AvatarPreviewModalProps {
  user: PublicUser;
  open: boolean;
  onClose: () => void;
}

export function AvatarPreviewModal({
  user,
  open,
  onClose,
}: AvatarPreviewModalProps) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const avatarUrl = useMemo(() => getAvatarUrl(user), [user]);
  const initials = useMemo(
    () => getAvatarInitials(user.profile.displayName || user.username),
    [user.profile.displayName, user.username],
  );

  useEffect(() => {
    if (open) {
      const mountFrame = window.requestAnimationFrame(() => {
        setMounted(true);
      });
      const visibleFrame = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setVisible(true));
      });

      return () => {
        window.cancelAnimationFrame(mountFrame);
        window.cancelAnimationFrame(visibleFrame);
      };
    }

    if (!mounted) {
      return;
    }

    const hideFrame = window.requestAnimationFrame(() => {
      setVisible(false);
    });
    const closeTimer = window.setTimeout(() => setMounted(false), 180);

    return () => {
      window.cancelAnimationFrame(hideFrame);
      window.clearTimeout(closeTimer);
    };
  }, [mounted, open]);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mounted, onClose]);

  if (!mounted) {
    return null;
  }

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[90] flex items-center justify-center bg-black/88 p-4 transition-opacity duration-150",
        visible ? "opacity-100" : "opacity-0",
      )}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      role="presentation"
    >
      <div
        className={cn(
          "relative w-full max-w-[min(92vw,760px)] overflow-hidden rounded-[28px] border border-white/10 bg-black shadow-[0_36px_120px_rgba(0,0,0,0.6)] transition duration-200",
          visible ? "translate-y-0 scale-100" : "translate-y-2 scale-[0.97]",
        )}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/25 text-[var(--text-soft)] transition-colors hover:border-white/16 hover:bg-black/40 hover:text-white"
          aria-label="Закрыть просмотр аватара"
        >
          <X className="h-4.5 w-4.5" />
        </button>

        <div className="grid gap-4 p-4 sm:p-5">
          <div className="pr-12">
            <p className="text-sm font-medium text-white">{user.profile.displayName}</p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">@{user.username}</p>
          </div>

          <div className="flex items-center justify-center rounded-[24px] border border-white/8 bg-black p-4 sm:p-6">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={user.profile.displayName}
                className="max-h-[72vh] w-auto max-w-full rounded-[22px] object-contain"
              />
            ) : (
              <div className="flex h-[min(60vw,320px)] w-[min(60vw,320px)] items-center justify-center rounded-full border border-white/8 bg-black text-[clamp(3rem,9vw,5.5rem)] font-semibold uppercase tracking-[0.08em] text-white">
                {initials}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
