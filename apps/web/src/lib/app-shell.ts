export type AppSection =
  | "overview"
  | "people"
  | "messages"
  | "hubs"
  | "settings"
  | "admin";

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
  const section = (segments[1] ?? "overview") as AppSection;

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
    section,
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
    case "overview":
      return {
        label: "Workspace",
        title: "Command center",
        description: "Overview of conversations, communities and private control.",
      };
    case "people":
      return {
        label: "Network",
        title: "People and relationships",
        description: "Friends, direct connections, blocks and private social graph.",
      };
    case "messages":
      return route.conversationId
        ? {
            label: "Messenger",
            title: "Direct conversation",
            description: "Live private thread with calls, unread state and retention rules.",
          }
        : {
            label: "Messenger",
            title: "Inbox and direct messages",
            description: "Unread flow, private channels and fast conversation launch.",
          };
    case "hubs":
      return route.hubId
        ? {
            label: "Community",
            title: "Hub space",
            description:
              "Channels, lobbies, live rooms and forum surfaces inside one community shell.",
          }
        : {
            label: "Community",
            title: "Hubs and spaces",
            description:
              "Discover, join and build community structures with roles and invitations.",
          };
    case "settings":
      return {
        label: "Preferences",
        title: "Personal settings",
        description:
          "Profile identity, appearance of presence and notification control belong to the same product system.",
      };
    case "admin":
      return {
        label: "Control",
        title: "Moderation and integrity",
        description:
          "Invites, audit and user control should feel like premium internal operations, not fallback admin pages.",
      };
  }
}

export function matchesPath(pathname: string, href: string) {
  if (href === "/app") {
    return pathname === "/app";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
