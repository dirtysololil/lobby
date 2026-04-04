"use client";

import { useEffect } from "react";
import type { HubShell } from "@lobby/shared";
import { primeHubShellCache } from "@/lib/hub-shell-cache";

interface HubShellBootstrapProps {
  hub: HubShell["hub"];
}

export function HubShellBootstrap({ hub }: HubShellBootstrapProps) {
  useEffect(() => {
    primeHubShellCache(hub);
  }, [hub]);

  return null;
}
