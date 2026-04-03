"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiClientFetch } from "@/lib/api-client";

export function LogoutButton() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function handleLogout(): Promise<void> {
    setIsPending(true);

    try {
      await apiClientFetch("/v1/auth/logout", {
        method: "POST",
      });

      startTransition(() => {
        router.push("/login");
        router.refresh();
      });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Button onClick={() => void handleLogout()} variant="secondary" disabled={isPending}>
      {isPending ? "Выходим..." : "Выйти"}
    </Button>
  );
}
