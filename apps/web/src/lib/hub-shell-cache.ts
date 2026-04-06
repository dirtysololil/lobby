import type { HubShell } from "@lobby/shared";

const hubShellCache = new Map<string, HubShell["hub"]>();
const hubShellListeners = new Map<
  string,
  Set<(hub: HubShell["hub"]) => void>
>();
const hubShellCacheBroadcastKey = "lobby:hub-shell-cache:clear";

let isHubShellCacheSyncBound = false;

function ensureHubShellCacheSync() {
  if (typeof window === "undefined" || isHubShellCacheSyncBound) {
    return;
  }

  window.addEventListener("storage", (event) => {
    if (event.key === hubShellCacheBroadcastKey) {
      clearHubShellCache();
    }
  });

  isHubShellCacheSyncBound = true;
}

export function getCachedHubShell(hubId: string) {
  ensureHubShellCacheSync();
  return hubShellCache.get(hubId) ?? null;
}

export function primeHubShellCache(hub: HubShell["hub"]) {
  ensureHubShellCacheSync();
  hubShellCache.set(hub.id, hub);
  hubShellListeners.get(hub.id)?.forEach((listener) => listener(hub));
}

export function clearHubShellCache() {
  ensureHubShellCacheSync();
  hubShellCache.clear();
}

export function broadcastHubShellCacheClear() {
  clearHubShellCache();

  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      hubShellCacheBroadcastKey,
      String(Date.now()),
    );
  } catch {
    // Ignore localStorage access issues and keep the local cache clear.
  }
}

export function subscribeToHubShellCache(
  hubId: string,
  listener: (hub: HubShell["hub"]) => void,
) {
  ensureHubShellCacheSync();
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
