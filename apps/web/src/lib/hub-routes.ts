export function buildHubLobbyHref(
  hubId: string,
  lobbyId: string,
  lobbyType: "TEXT" | "VOICE" | "FORUM",
): string {
  if (lobbyType === "FORUM") {
    return `/app/hubs/${hubId}/forum/${lobbyId}`;
  }

  return `/app/hubs/${hubId}/lobbies/${lobbyId}`;
}
