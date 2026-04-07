const logoutBroadcastKey = "lobby:auth:logout";

export function broadcastLogoutEvent() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(logoutBroadcastKey, String(Date.now()));
  } catch {
    // Ignore storage access errors during logout cleanup.
  }
}

export function subscribeToLogoutEvent(listener: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === logoutBroadcastKey) {
      listener();
    }
  };

  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener("storage", handleStorage);
  };
}
