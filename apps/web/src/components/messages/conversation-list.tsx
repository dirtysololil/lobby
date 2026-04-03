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
      setErrorMessage(error instanceof Error ? error.message : "Не удалось загрузить диалоги");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleOpenConversation() {
    if (!username.trim()) return;

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
      setErrorMessage(error instanceof Error ? error.message : "Не удалось открыть диалог");
    } finally {
      setIsOpening(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Личные сообщения</CardTitle>
        <CardDescription>Откройте существующий диалог или начните новый по username.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <form
          className="flex flex-col gap-3 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            void handleOpenConversation();
          }}
        >
          <Input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="username" autoComplete="off" />
          <Button type="submit" disabled={isOpening}>{isOpening ? "Открываем..." : "Открыть диалог"}</Button>
        </form>

        {errorMessage ? <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{errorMessage}</div> : null}

        {isLoading ? (
          <div className="rounded-3xl border border-[var(--border)] bg-slate-950/40 p-5 text-sm text-slate-400">Загружаем диалоги...</div>
        ) : conversations.length === 0 ? (
          <div className="rounded-3xl border border-[var(--border)] bg-slate-950/40 p-5 text-sm text-slate-500">Пока нет личных диалогов.</div>
        ) : (
          <div className="space-y-2">
            {conversations.map((conversation) => (
              <Link key={conversation.id} href={`/app/messages/${conversation.id}`} className="block rounded-3xl border border-[var(--border)] bg-slate-950/35 p-4 transition hover:border-cyan-300/30 hover:bg-white/[0.04]">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">{conversation.counterpart.profile.displayName}</p>
                    <p className="font-mono text-xs text-cyan-100/75">@{conversation.counterpart.username}</p>
                    <p className="mt-2 text-sm text-slate-400">{conversation.lastMessage?.isDeleted ? "Последнее сообщение удалено" : conversation.lastMessage?.content ?? "Диалог пуст"}</p>
                  </div>
                  <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-slate-300">Непрочитано: {conversation.unreadCount}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
