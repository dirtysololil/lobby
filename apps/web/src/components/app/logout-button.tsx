"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useCallSession } from "@/components/calls/call-session-provider";
import { useRealtime } from "@/components/realtime/realtime-provider";
import { Button, type ButtonProps } from "@/components/ui/button";
import { apiClientFetch } from "@/lib/api-client";
import { broadcastHubShellCacheClear } from "@/lib/hub-shell-cache";
import { broadcastLogoutEvent } from "@/lib/logout-broadcast";
import { cn } from "@/lib/utils";

interface LogoutButtonProps extends Omit<ButtonProps, "children" | "onClick"> {
  label?: string;
  pendingLabel?: string;
  showIcon?: boolean;
}

export function LogoutButton({
  className,
  label = "Выйти",
  pendingLabel = "Выходим...",
  showIcon = true,
  size = "sm",
  variant = "secondary",
  ...buttonProps
}: LogoutButtonProps) {
  const router = useRouter();
  const { prepareForLogout } = useCallSession();
  const { disconnectRealtime } = useRealtime();
  const [isPending, setIsPending] = useState(false);

  async function handleLogout(): Promise<void> {
    if (isPending) {
      return;
    }

    setIsPending(true);

    try {
      await prepareForLogout();
      disconnectRealtime();
      broadcastHubShellCacheClear();

      try {
        await apiClientFetch("/v1/auth/logout", {
          method: "POST",
        });
      } catch (error) {
        console.warn("[auth/logout] API returned an error", error);
      }

      broadcastLogoutEvent();
    } finally {
      startTransition(() => {
        router.replace("/login");
        router.refresh();
      });

      if (typeof window !== "undefined") {
        window.setTimeout(() => {
          if (window.location.pathname.startsWith("/app")) {
            window.location.replace("/login");
          }
        }, 180);
      }
    }
  }

  return (
    <Button
      onClick={() => void handleLogout()}
      size={size}
      variant={variant}
      disabled={isPending}
      className={cn(className)}
      {...buttonProps}
    >
      {showIcon ? <LogOut className="h-4 w-4" /> : null}
      {isPending ? pendingLabel : label}
    </Button>
  );
}
