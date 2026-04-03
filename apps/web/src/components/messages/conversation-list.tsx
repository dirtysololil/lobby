"use client";

import Link from "next/link";
import { Search, Sparkles } from "lucide-react";
import { directConversationListResponseSchema, directConversationSummaryResponseSchema, type DirectConversationSummary } from "@lobby/shared";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClientFetch } from "@/lib/api-client";

export function ConversationList() {
  const router = useRouter();
  const [conversations, setConversations] = useState<DirectConversationSummary[]>([]);
  const [username, setUsername] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpening, setIsOpening] = useState(false);

  useEffect(() => { void loadConversations(); }, []);

  async function loadConversations() {
    setIsLoading(true);
    try {
      const payload = await apiClientFetch("/v1/direct-messages");
      setConversations(directConversationListResponseSchema.parse(payload).items);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось загрузить диалоги");
    } finally { setIsLoading(false); }
  }

  async function handleOpenConversation() {
    if (!username.trim()) return;
    setIsOpening(true);
    try {
      const payload = await apiClientFetch("/v1/direct-messages/open", { method: "POST", body: JSON.stringify({ username: username.trim().toLowerCase() }) });
      const conversation = directConversationSummaryResponseSchema.parse(payload).conversation;
      router.push(`/app/messages/${conversation.id}`);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось открыть диалог");
    } finally { setIsOpening(false); }
  }

  return (
    <section className="social-shell rounded-[28px] p-5">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]">Мессенджер</p>
          <h1 className="mt-2 text-3xl font-semibold">Личные диалоги</h1>
          <p className="mt-2 text-sm text-[var(--text-dim)]">Плотный список активных контактов, непрочитанные и быстрый старт нового чата.</p>
        </div>
        <div className="premium-tile flex items-center gap-2 rounded-2xl px-3 py-2 text-xs text-[var(--text-dim)]"><Sparkles className="h-4 w-4 text-[#9ac8ff]" />Private messaging</div>
      </div>

      <form className="premium-tile mb-5 flex flex-col gap-3 rounded-2xl p-3 sm:flex-row" onSubmit={(event) => { event.preventDefault(); void handleOpenConversation(); }}>
        <div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[var(--text-muted)]" /><Input className="pl-9" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="username для нового диалога" autoComplete="off" /></div>
        <Button type="submit" disabled={isOpening}>{isOpening ? "Открываем..." : "Создать / открыть"}</Button>
      </form>

      {errorMessage ? <div className="mb-4 rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{errorMessage}</div> : null}

      {isLoading ? <div className="premium-tile rounded-2xl p-5 text-sm text-[var(--text-muted)]">Загружаем диалоги...</div> : conversations.length === 0 ? <div className="premium-tile rounded-2xl p-5 text-sm text-[var(--text-muted)]">Диалогов пока нет. Начните первый контакт через username.</div> : (
        <div className="space-y-2">
          {conversations.map((conversation) => (
            <Link key={conversation.id} href={`/app/messages/${conversation.id}`} className="premium-tile block rounded-2xl p-4 transition hover:border-[var(--border-strong)] hover:bg-white/[0.05]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{conversation.counterpart.profile.displayName}</p>
                  <p className="font-mono text-xs text-[#a8cfff]">@{conversation.counterpart.username}</p>
                  <p className="mt-2 truncate text-sm text-[var(--text-dim)]">{conversation.lastMessage?.isDeleted ? "Последнее сообщение удалено" : conversation.lastMessage?.content ?? "Диалог пуст"}</p>
                </div>
                <span className="rounded-full border border-[var(--border)] px-3 py-1 text-[11px] uppercase tracking-[0.15em] text-[var(--text-dim)]">{conversation.unreadCount > 0 ? `+${conversation.unreadCount}` : "0"}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
