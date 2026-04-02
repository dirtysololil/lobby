"use client";

import {
  blocksResponseSchema,
  friendshipsResponseSchema,
  userSearchResponseSchema,
  directConversationSummaryResponseSchema,
  type BlockRecord,
  type FriendshipRecord,
  type UserSearchResult,
} from "@lobby/shared";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClientFetch } from "@/lib/api-client";
import { FriendshipPanels } from "./friendship-panels";
import { UserSearchPanel } from "./user-search-panel";

export function PeopleWorkspace() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [friendships, setFriendships] = useState<FriendshipRecord[]>([]);
  const [blocks, setBlocks] = useState<BlockRecord[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [actionKey, setActionKey] = useState<string | null>(null);

  useEffect(() => {
    void refreshPanels();
  }, []);

  async function refreshPanels() {
    try {
      const [friendshipsPayload, blocksPayload] = await Promise.all([
        apiClientFetch("/v1/relationships/friends"),
        apiClientFetch("/v1/relationships/blocks"),
      ]);

      setFriendships(friendshipsResponseSchema.parse(friendshipsPayload).items);
      setBlocks(blocksResponseSchema.parse(blocksPayload).items);
      setPanelError(null);
    } catch (error) {
      setPanelError(error instanceof Error ? error.message : "Unable to load people data");
    }
  }

  async function refreshSearch() {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      setResults([]);
      setSearchError(null);
      return;
    }

    setIsSearching(true);

    try {
      const payload = await apiClientFetch(`/v1/users/search?query=${encodeURIComponent(normalizedQuery)}`);
      setResults(userSearchResponseSchema.parse(payload).items);
      setSearchError(null);
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : "Unable to search users");
    } finally {
      setIsSearching(false);
    }
  }

  async function withAction(key: string, action: () => Promise<void>) {
    setActionKey(key);

    try {
      await action();
      await refreshPanels();
      await refreshSearch();
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : "Action failed");
    } finally {
      setActionKey(null);
    }
  }

  async function openDm(username: string) {
    await withAction(`SEARCH:${username}`, async () => {
      const payload = await apiClientFetch("/v1/direct-messages/open", {
        method: "POST",
        body: JSON.stringify({ username }),
      });

      const conversation = directConversationSummaryResponseSchema.parse(payload).conversation;
      router.push(`/app/messages/${conversation.id}`);
      router.refresh();
    });
  }

  return (
    <section className="grid gap-6">
      {panelError ? (
        <div className="rounded-3xl border border-rose-400/20 bg-rose-400/10 px-5 py-4 text-sm text-rose-100">
          {panelError}
        </div>
      ) : null}

      <UserSearchPanel
        query={query}
        results={results}
        searchError={searchError}
        isSearching={isSearching}
        actionKey={actionKey}
        onQueryChange={setQuery}
        onSearch={refreshSearch}
        onSendFriendRequest={(username) =>
          withAction(`SEARCH:${username}`, async () => {
            await apiClientFetch("/v1/relationships/friends/request", {
              method: "POST",
              body: JSON.stringify({ username }),
            });
          })
        }
        onAcceptFriendRequest={(username) =>
          withAction(`SEARCH:${username}`, async () => {
            await apiClientFetch("/v1/relationships/friends/accept", {
              method: "POST",
              body: JSON.stringify({ username }),
            });
          })
        }
        onRemoveFriendship={(username) =>
          withAction(`SEARCH:${username}`, async () => {
            await apiClientFetch("/v1/relationships/friends/remove", {
              method: "POST",
              body: JSON.stringify({ username }),
            });
          })
        }
        onBlock={(username) =>
          withAction(`SEARCH:${username}`, async () => {
            await apiClientFetch("/v1/relationships/blocks", {
              method: "POST",
              body: JSON.stringify({ username }),
            });
          })
        }
        onUnblock={(username) =>
          withAction(`SEARCH:${username}`, async () => {
            await apiClientFetch("/v1/relationships/blocks/unblock", {
              method: "POST",
              body: JSON.stringify({ username }),
            });
          })
        }
        onOpenDm={openDm}
      />

      <FriendshipPanels
        friendships={friendships}
        blocks={blocks}
        actionKey={actionKey}
        onAccept={(username) =>
          withAction(`INCOMING_REQUEST:${username}`, async () => {
            await apiClientFetch("/v1/relationships/friends/accept", {
              method: "POST",
              body: JSON.stringify({ username }),
            });
          })
        }
        onRemove={(username) =>
          withAction(`ACCEPTED:${username}`, async () => {
            await apiClientFetch("/v1/relationships/friends/remove", {
              method: "POST",
              body: JSON.stringify({ username }),
            });
          })
        }
        onBlock={(username) =>
          withAction(`ACCEPTED:${username}`, async () => {
            await apiClientFetch("/v1/relationships/blocks", {
              method: "POST",
              body: JSON.stringify({ username }),
            });
          })
        }
        onUnblock={(username) =>
          withAction(`UNBLOCK:${username}`, async () => {
            await apiClientFetch("/v1/relationships/blocks/unblock", {
              method: "POST",
              body: JSON.stringify({ username }),
            });
          })
        }
        onOpenDm={openDm}
      />
    </section>
  );
}
