export type AppSection = "people" | "messages" | "hubs" | "settings" | "admin";

export interface AppRouteState {
  section: AppSection;
  hubId: string | null;
  lobbyId: string | null;
  topicId: string | null;
  conversationId: string | null;
  settingsSection: string | null;
  adminSection: string | null;
}

export function parseAppPath(pathname: string): AppRouteState {
  const segments = pathname.split("/").filter(Boolean);
  const section = ((segments[1] ?? "messages") as AppSection) || "messages";

  if (section === "messages") {
    return {
      section,
      hubId: null,
      lobbyId: null,
      topicId: null,
      conversationId: segments[2] ?? null,
      settingsSection: null,
      adminSection: null,
    };
  }

  if (section === "hubs") {
    const hubId = segments[2] ?? null;
    const isForum = segments[3] === "forum";
    const isLobby = segments[3] === "lobbies";

    return {
      section,
      hubId,
      lobbyId:
        (isForum || isLobby ? segments[4] : null) ??
        (segments[3] ? segments[3] : null),
      topicId: isForum && segments[5] === "topics" ? (segments[6] ?? null) : null,
      conversationId: null,
      settingsSection: null,
      adminSection: null,
    };
  }

  if (section === "settings") {
    return {
      section,
      hubId: null,
      lobbyId: null,
      topicId: null,
      conversationId: null,
      settingsSection: segments[2] ?? "profile",
      adminSection: null,
    };
  }

  if (section === "admin") {
    return {
      section,
      hubId: null,
      lobbyId: null,
      topicId: null,
      conversationId: null,
      settingsSection: null,
      adminSection: segments[2] ?? "overview",
    };
  }

  return {
    section: "messages",
    hubId: null,
    lobbyId: null,
    topicId: null,
    conversationId: null,
    settingsSection: null,
    adminSection: null,
  };
}

export function getSectionMeta(route: AppRouteState) {
  switch (route.section) {
    case "people":
      return {
        label: "People",
        title: "People",
        description: "Friends, requests and discovery.",
      };
    case "messages":
      return route.conversationId
        ? {
            label: "Direct Message",
            title: "Conversation",
            description: "Private chat, call state and message history.",
          }
        : {
            label: "Inbox",
            title: "Messages",
            description: "Recent conversations and direct lines.",
          };
    case "hubs":
      return route.hubId
        ? {
            label: "Hub",
            title: "Hub",
            description: "Channels, members and community flow.",
          }
        : {
            label: "Hubs",
            title: "Hubs",
            description: "Spaces, invites and channel structure.",
          };
    case "settings":
      return {
        label: "Settings",
        title: "Settings",
        description: "Profile, presence and notification rules.",
      };
    case "admin":
      return {
        label: "Admin",
        title: "Control",
        description: "Internal moderation and platform operations.",
      };
  }
}

export function matchesPath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
