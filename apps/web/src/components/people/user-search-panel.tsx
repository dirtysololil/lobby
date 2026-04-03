"use client";

import Link from "next/link";
import type { UserSearchResult } from "@lobby/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface UserSearchPanelProps {
  query: string;
  results: UserSearchResult[];
  searchError: string | null;
  isSearching: boolean;
  actionKey: string | null;
  onQueryChange: (value: string) => void;
  onSearch: () => Promise<void>;
  onSendFriendRequest: (username: string) => Promise<void>;
  onAcceptFriendRequest: (username: string) => Promise<void>;
  onRemoveFriendship: (username: string) => Promise<void>;
  onBlock: (username: string) => Promise<void>;
  onUnblock: (username: string) => Promise<void>;
  onOpenDm: (username: string) => Promise<void>;
}

export function UserSearchPanel(props: UserSearchPanelProps) {
  const { query, results, searchError, isSearching, actionKey, onQueryChange, onSearch, onSendFriendRequest, onAcceptFriendRequest, onRemoveFriendship, onBlock, onUnblock, onOpenDm } = props;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Поиск пользователей</CardTitle>
        <CardDescription>Поиск по username. Каталог пользователей публично не раскрывается.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form className="flex flex-col gap-3 sm:flex-row" onSubmit={(event) => { event.preventDefault(); void onSearch(); }}>
          <Input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Введите username" autoComplete="off" />
          <Button type="submit" disabled={isSearching}>{isSearching ? "Ищем..." : "Найти"}</Button>
        </form>

        {searchError ? <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{searchError}</div> : null}

        {results.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border)] bg-slate-950/40 p-4 text-sm text-slate-500">Здесь появятся найденные пользователи.</div>
        ) : (
          <div className="space-y-2.5">
            {results.map((item) => {
              const busyKey = `SEARCH:${item.user.username}`;
              return (
                <div key={item.user.id} className="rounded-2xl border border-[var(--border)] bg-slate-950/40 p-4">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div className="space-y-1">
                      <p className="text-base font-medium text-white">{item.user.profile.displayName}</p>
                      <p className="font-mono text-xs text-cyan-100/75">@{item.user.username}</p>
                      <p className="text-sm leading-6 text-slate-400">{item.user.profile.bio ?? "Описание профиля не заполнено."}</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {item.relationship.isBlockedByViewer ? (
                        <Button size="sm" variant="secondary" onClick={() => void onUnblock(item.user.username)} disabled={actionKey === busyKey}>Разблокировать</Button>
                      ) : (
                        <>
                          {(item.relationship.friendshipState === "NONE" || item.relationship.friendshipState === "REMOVED") ? <Button size="sm" onClick={() => void onSendFriendRequest(item.user.username)} disabled={actionKey === busyKey || item.relationship.hasBlockedViewer}>Добавить</Button> : null}
                          {item.relationship.friendshipState === "INCOMING_REQUEST" ? <Button size="sm" onClick={() => void onAcceptFriendRequest(item.user.username)} disabled={actionKey === busyKey}>Принять</Button> : null}
                          {(item.relationship.friendshipState === "OUTGOING_REQUEST" || item.relationship.friendshipState === "ACCEPTED") ? <Button size="sm" variant="secondary" onClick={() => void onRemoveFriendship(item.user.username)} disabled={actionKey === busyKey}>Убрать</Button> : null}
                          <Button size="sm" variant="secondary" onClick={() => void onOpenDm(item.user.username)} disabled={actionKey === busyKey || item.relationship.hasBlockedViewer}>{item.relationship.dmConversationId ? "Открыть чат" : "Начать чат"}</Button>
                          <Button size="sm" variant="destructive" onClick={() => void onBlock(item.user.username)} disabled={actionKey === busyKey}>Блок</Button>
                        </>
                      )}
                    </div>
                  </div>

                  {item.relationship.dmConversationId ? (
                    <div className="mt-3 border-t border-[var(--border)] pt-3 text-sm text-slate-400">Существующий диалог: <Link href={`/app/messages/${item.relationship.dmConversationId}`} className="text-cyan-300 hover:text-cyan-200">открыть</Link></div>
                  ) : null}
                  {item.relationship.hasBlockedViewer ? <p className="mt-3 text-sm text-rose-200/90">Этот пользователь вас заблокировал. Часть действий недоступна.</p> : null}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
