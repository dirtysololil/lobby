export type AppSection = "people" | "messages" | "hubs" | "settings" | "admin";

export interface AppRouteState {
  section: AppSection;
  hubId: string | null;
  lobbyId: string | null;
  topicId: string | null;
  conversationId: string | null;
  peopleUsername: string | null;
  settingsSection: string | null;
  adminSection: string | null;
}

export function parseAppPath(pathname: string | null | undefined): AppRouteState {
  const normalizedPathname = pathname ?? "";
  const segments = normalizedPathname.split("/").filter(Boolean);
  const section = ((segments[1] ?? "messages") as AppSection) || "messages";

  if (section === "messages") {
    return {
      section,
      hubId: null,
      lobbyId: null,
      topicId: null,
      conversationId: segments[2] ?? null,
      peopleUsername: null,
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
      peopleUsername: null,
      settingsSection: null,
      adminSection: null,
    };
  }

  if (section === "people") {
    return {
      section,
      hubId: null,
      lobbyId: null,
      topicId: null,
      conversationId: null,
      peopleUsername: segments[2] ?? null,
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
      peopleUsername: null,
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
      peopleUsername: null,
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
    peopleUsername: null,
    settingsSection: null,
    adminSection: null,
  };
}

export function getSectionMeta(route: AppRouteState) {
  switch (route.section) {
    case "people":
      if (route.peopleUsername) {
        return {
          label: "Profile",
          title: `@${route.peopleUsername}`,
          description: "Public profile, quick social actions and direct-message entry point.",
        };
      }

      return {
        label: "Люди",
        title: "Люди",
        description: "Друзья, заявки и поиск новых контактов.",
      };
    case "messages":
      return route.conversationId
        ? {
            label: "Чат",
            title: "Диалог",
            description: "Личная переписка, звонок и история сообщений.",
          }
        : {
            label: "Входящие",
            title: "Недавние диалоги",
            description: "Актуальные переписки и быстрый вход в личные сообщения.",
          };
    case "hubs":
      return route.hubId
        ? {
            label: "Хаб",
            title: "Пространство хаба",
            description: "Каналы, участники и общий ритм сообщества.",
          }
        : {
            label: "Хабы",
            title: "Хабы",
            description: "Пространства, инвайты и структура каналов.",
          };
    case "settings":
      return {
        label: "Настройки",
        title: "Настройки",
        description: "Профиль, присутствие и правила уведомлений.",
      };
    case "admin":
      return {
        label: "Админка",
        title: "Управление",
        description: "Модерация и служебные операции платформы.",
      };
  }
}

export function matchesPath(pathname: string | null | undefined, href: string) {
  const normalizedPathname = pathname ?? "";
  return normalizedPathname === href || normalizedPathname.startsWith(`${href}/`);
}
