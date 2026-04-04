import type { HubShell } from "@lobby/shared";

const hubShellCache = new Map<string, HubShell["hub"]>();
const hubShellListeners = new Map<
  string,
  Set<(hub: HubShell["hub"]) => void>
>();

export function getCachedHubShell(hubId: string) {
  return hubShellCache.get(hubId) ?? null;
}

export function primeHubShellCache(hub: HubShell["hub"]) {
  hubShellCache.set(hub.id, hub);
  hubShellListeners.get(hub.id)?.forEach((listener) => listener(hub));
}

export function subscribeToHubShellCache(
  hubId: string,
  listener: (hub: HubShell["hub"]) => void,
) {
  const listeners = hubShellListeners.get(hubId) ?? new Set();
  listeners.add(listener);
  hubShellListeners.set(hubId, listeners);

  return () => {
    const currentListeners = hubShellListeners.get(hubId);
    currentListeners?.delete(listener);

    if (currentListeners && currentListeners.size === 0) {
      hubShellListeners.delete(hubId);
    }
  };
}
