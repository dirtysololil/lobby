"use client";

import Link from "next/link";
import { Search, ShieldBan, Sparkles, UserPlus2, Users2 } from "lucide-react";
import type { UserSearchResult } from "@lobby/shared";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  const {
    query,
    results,
    searchError,
    isSearching,
    actionKey,
    onQueryChange,
    onSearch,
    onSendFriendRequest,
    onAcceptFriendRequest,
    onRemoveFriendship,
    onBlock,
    onUnblock,
    onOpenDm,
  } = props;

  return (
    <Card>
      <CardHeader>
        <span className="eyebrow-pill">
          <Search className="h-3.5 w-3.5" /> Люди
        </span>
        <CardTitle>Поиск пользователей</CardTitle>
        <CardDescription>
          Поиск идёт по username. Публичный каталог не раскрывается, поэтому
          новые связи и диалоги всегда начинаются осознанно.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="metric-tile rounded-[24px] p-4">
            <p className="section-kicker">Найдено</p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {results.length}
            </p>
          </div>
          <div className="metric-tile rounded-[24px] p-4">
            <p className="section-kicker">Доступные действия</p>
            <p className="mt-2 text-sm font-semibold text-white">
              Связь, дружба, DM
            </p>
          </div>
          <div className="metric-tile rounded-[24px] p-4">
            <p className="section-kicker">Безопасность</p>
            <p className="mt-2 text-sm font-semibold text-white">
              Каталог закрыт
            </p>
          </div>
        </div>

        <form
          className="surface-highlight flex flex-col gap-3 rounded-[26px] p-4 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            void onSearch();
          }}
        >
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Введите username"
            autoComplete="off"
          />
          <Button type="submit" disabled={isSearching}>
            {isSearching ? "Ищем..." : "Найти"}
          </Button>
        </form>

        {searchError ? (
          <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            {searchError}
          </div>
        ) : null}

        {results.length === 0 ? (
          <div className="surface-subtle rounded-[24px] p-4 text-sm leading-7 text-slate-500">
            Здесь появятся найденные пользователи. Откройте точечный поиск по
            username, чтобы добавить человека в свой приватный круг общения.
          </div>
        ) : (
          <div className="space-y-2.5">
            {results.map((item) => {
              const busyKey = `SEARCH:${item.user.username}`;
              return (
                <div key={item.user.id} className="list-row rounded-[26px] p-4">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-medium text-white">
                          {item.user.profile.displayName}
                        </p>
                        {item.relationship.friendshipState === "ACCEPTED" ? (
                          <span className="glass-badge">
                            <Users2 className="h-3 w-3" />
                            друг
                          </span>
                        ) : null}
                      </div>
                      <p className="font-mono text-xs text-[var(--text-soft)]">
                        @{item.user.username}
                      </p>
                      <p className="text-sm leading-6 text-slate-400">
                        {item.user.profile.bio ??
                          "Описание профиля не заполнено."}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {item.relationship.isBlockedByViewer ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => void onUnblock(item.user.username)}
                          disabled={actionKey === busyKey}
                        >
                          Разблокировать
                        </Button>
                      ) : (
                        <>
                          {item.relationship.friendshipState === "NONE" ||
                          item.relationship.friendshipState === "REMOVED" ? (
                            <Button
                              size="sm"
                              onClick={() =>
                                void onSendFriendRequest(item.user.username)
                              }
                              disabled={
                                actionKey === busyKey ||
                                item.relationship.hasBlockedViewer
                              }
                            >
                              <UserPlus2 className="h-3.5 w-3.5" />
                              Добавить
                            </Button>
                          ) : null}
                          {item.relationship.friendshipState ===
                          "INCOMING_REQUEST" ? (
                            <Button
                              size="sm"
                              onClick={() =>
                                void onAcceptFriendRequest(item.user.username)
                              }
                              disabled={actionKey === busyKey}
                            >
                              Принять
                            </Button>
                          ) : null}
                          {item.relationship.friendshipState ===
                            "OUTGOING_REQUEST" ||
                          item.relationship.friendshipState === "ACCEPTED" ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() =>
                                void onRemoveFriendship(item.user.username)
                              }
                              disabled={actionKey === busyKey}
                            >
                              Убрать
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => void onOpenDm(item.user.username)}
                            disabled={
                              actionKey === busyKey ||
                              item.relationship.hasBlockedViewer
                            }
                          >
                            {item.relationship.dmConversationId
                              ? "Открыть чат"
                              : "Начать чат"}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => void onBlock(item.user.username)}
                            disabled={actionKey === busyKey}
                          >
                            <ShieldBan className="h-3.5 w-3.5" />
                            Блок
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {item.relationship.dmConversationId ? (
                    <div className="mt-3 border-t border-[var(--border)] pt-3 text-sm text-slate-400">
                      Существующий диалог:{" "}
                      <Link
                        href={`/app/messages/${item.relationship.dmConversationId}`}
                        className="text-[var(--accent)] hover:text-[var(--accent-strong)]"
                      >
                        открыть
                      </Link>
                    </div>
                  ) : null}
                  {item.relationship.hasBlockedViewer ? (
                    <p className="mt-3 text-sm text-rose-200/90">
                      Этот пользователь вас заблокировал. Часть действий
                      недоступна.
                    </p>
                  ) : null}
                  {!item.relationship.hasBlockedViewer ? (
                    <div className="mt-3 inline-flex items-center gap-2 text-xs text-[var(--text-muted)]">
                      <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
                      Человек может быть добавлен в ваш приватный круг.
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
