"use client";

import Link from "next/link";
import {
  directConversationListResponseSchema,
  directConversationSummaryResponseSchema,
  type DirectConversationSummary,
} from "@lobby/shared";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiClientFetch } from "@/lib/api-client";

export function ConversationList() {
  const router = useRouter();
  const [conversations, setConversations] = useState<DirectConversationSummary[]>([]);
  const [username, setUsername] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpening, setIsOpening] = useState(false);

  useEffect(() => {
    void loadConversations();
  }, []);

  async function loadConversations() {
    setIsLoading(true);

    try {
      const payload = await apiClientFetch("/v1/direct-messages");
      setConversations(directConversationListResponseSchema.parse(payload).items);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load conversations");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleOpenConversation() {
    if (!username.trim()) {
      return;
    }

    setIsOpening(true);

    try {
      const payload = await apiClientFetch("/v1/direct-messages/open", {
        method: "POST",
        body: JSON.stringify({ username: username.trim().toLowerCase() }),
      });

      const conversation = directConversationSummaryResponseSchema.parse(payload).conversation;
      router.push(`/app/messages/${conversation.id}`);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to open direct conversation");
    } finally {
      setIsOpening(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Direct messages</CardTitle>
        <CardDescription>Open an existing DM or create one by exact username.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <form
          className="flex flex-col gap-3 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            void handleOpenConversation();
          }}
        >
          <Input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="username"
            autoComplete="off"
          />
          <Button type="submit" disabled={isOpening}>
            {isOpening ? "Opening..." : "Open DM"}
          </Button>
        </form>

        {errorMessage ? (
          <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            {errorMessage}
          </div>
        ) : null}

        {isLoading ? (
          <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-5 text-sm text-slate-400">
            Loading conversations...
          </div>
        ) : conversations.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-5 text-sm text-slate-500">
            No direct conversations yet.
          </div>
        ) : (
          <div className="space-y-3">
            {conversations.map((conversation) => (
              <Link
                key={conversation.id}
                href={`/app/messages/${conversation.id}`}
                className="block rounded-3xl border border-white/10 bg-slate-950/35 p-5 transition hover:border-sky-300/20 hover:bg-white/[0.04]"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">
                      {conversation.counterpart.profile.displayName}
                    </p>
                    <p className="font-mono text-xs text-sky-200/75">@{conversation.counterpart.username}</p>
                    <p className="mt-2 text-sm text-slate-400">
                      {conversation.lastMessage?.isDeleted
                        ? "Last message was deleted"
                        : conversation.lastMessage?.content ?? "Conversation has no messages yet"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                    <span className="rounded-full border border-white/10 px-3 py-1">
                      unread: {conversation.unreadCount}
                    </span>
                    <span className="rounded-full border border-white/10 px-3 py-1">
                      {conversation.settings.notificationSetting}
                    </span>
                    <span className="rounded-full border border-white/10 px-3 py-1">
                      {conversation.retentionMode}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
