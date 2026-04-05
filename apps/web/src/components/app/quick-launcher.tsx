"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Layers3, MessageSquareMore, Search, Settings2, Users2 } from "lucide-react";
import { directConversationListResponseSchema, hubListResponseSchema } from "@lobby/shared";
import { apiClientFetch } from "@/lib/api-client";

type LauncherItem = {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: typeof MessageSquareMore;
  type: "route" | "hub" | "conversation";
};

const staticItems: LauncherItem[] = [
  {
    id: "route:messages",
    label: "Сообщения",
    description: "Недавние диалоги и входящие",
    href: "/app/messages",
    icon: MessageSquareMore,
    type: "route",
  },
  {
    id: "route:people",
    label: "Люди",
    description: "Друзья, заявки и поиск",
    href: "/app/people?view=friends",
    icon: Users2,
    type: "route",
  },
  {
    id: "route:hubs",
    label: "Хабы",
    description: "Общие пространства",
    href: "/app/hubs",
    icon: Layers3,
    type: "route",
  },
  {
    id: "route:settings",
    label: "Настройки",
    description: "Профиль и уведомления",
    href: "/app/settings/profile",
    icon: Settings2,
    type: "route",
  },
];

export function QuickLauncher() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<LauncherItem[]>(staticItems);
  const [isLoading, setIsLoading] = useState(false);
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }

      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeydown);

    return () => {
      window.removeEventListener("keydown", handleKeydown);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    inputRef.current?.focus();

    if (items.length > staticItems.length) {
      return;
    }

    let active = true;
    setIsLoading(true);

    void (async () => {
      try {
        const [hubsPayload, conversationsPayload] = await Promise.all([
          apiClientFetch("/v1/hubs"),
          apiClientFetch("/v1/direct-messages"),
        ]);

        const hubs = hubListResponseSchema.parse(hubsPayload).items.map(
            (hub) =>
            ({
              id: `hub:${hub.id}`,
              label: hub.name,
              description: hub.description ?? "Хаб",
              href: `/app/hubs/${hub.id}`,
              icon: Layers3,
              type: "hub",
            }) satisfies LauncherItem,
        );

        const conversations = directConversationListResponseSchema
          .parse(conversationsPayload)
          .items.map(
            (conversation) =>
              ({
                id: `conversation:${conversation.id}`,
                label: conversation.counterpart.profile.displayName,
                description: `@${conversation.counterpart.username}`,
                href: `/app/messages/${conversation.id}`,
                icon: MessageSquareMore,
                type: "conversation",
              }) satisfies LauncherItem,
          );

        if (active) {
          setItems([...staticItems, ...hubs, ...conversations]);
        }
      } catch {
        if (active) {
          setItems(staticItems);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [items.length, open]);

  const filteredItems = useMemo(() => {
    const normalized = deferredQuery.trim().toLowerCase();

    if (!normalized) {
      return items.slice(0, 10);
    }

    return items
      .filter((item) =>
        `${item.label} ${item.description} ${item.type}`.toLowerCase().includes(normalized),
      )
      .slice(0, 10);
  }, [deferredQuery, items]);

  function navigate(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="topbar-search">
        <span className="inline-flex items-center gap-2">
          <Search className="h-4 w-4" />
          Перейти к диалогу или хабу
        </span>
        <span className="glass-badge">Ctrl K</span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 py-8">
          <div className="social-shell w-full max-w-[560px] rounded-[18px] p-2.5">
            <div className="flex items-center gap-3 rounded-[12px] border border-[var(--border)] bg-[var(--bg-panel-soft)] px-3">
              <Search className="h-4 w-4 text-[var(--text-muted)]" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Поиск по чатам, людям и хабам"
                className="h-10 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-[var(--text-muted)]"
              />
              <button type="button" onClick={() => setOpen(false)} className="glass-badge">
                Esc
              </button>
            </div>

            <div className="mt-2.5 grid gap-1">
              {isLoading ? (
                <div className="surface-subtle rounded-[12px] px-3 py-2.5 text-sm text-[var(--text-muted)]">
                  Загружаем результаты...
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="surface-subtle rounded-[12px] px-3 py-2.5 text-sm text-[var(--text-muted)]">
                  Ничего не найдено.
                </div>
              ) : (
                filteredItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigate(item.href)}
                    className="list-row flex items-center gap-3 rounded-[12px] px-3 py-2 text-left"
                  >
                    <span className="dock-icon flex h-8 w-8 items-center justify-center rounded-[10px]">
                      <item.icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-white">
                        {item.label}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-[var(--text-dim)]">
                        {item.description}
                      </span>
                    </span>
                    <span className="glass-badge">
                      <CornerDownLeft className="h-3 w-3" />
                      Открыть
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
