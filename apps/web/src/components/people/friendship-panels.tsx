"use client";

import type { BlockRecord, FriendshipRecord } from "@lobby/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface FriendshipPanelsProps {
  friendships: FriendshipRecord[];
  blocks: BlockRecord[];
  actionKey: string | null;
  onAccept: (username: string) => Promise<void>;
  onRemove: (username: string) => Promise<void>;
  onBlock: (username: string) => Promise<void>;
  onUnblock: (username: string) => Promise<void>;
  onOpenDm: (username: string) => Promise<void>;
}

const friendshipSections = [
  { title: "Входящие", state: "INCOMING_REQUEST" },
  { title: "Исходящие", state: "OUTGOING_REQUEST" },
  { title: "Друзья", state: "ACCEPTED" },
  { title: "Удалённые", state: "REMOVED" },
] as const;

export function FriendshipPanels({ friendships, blocks, actionKey, onAccept, onRemove, onBlock, onUnblock, onOpenDm }: FriendshipPanelsProps) {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <Card>
        <CardHeader>
          <CardTitle>Связи</CardTitle>
          <CardDescription>Статусы дружбы и обращения в личные сообщения.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {friendshipSections.map((section) => {
            const items = friendships.filter((friendship) => friendship.state === section.state);
            return (
              <div key={section.title} className="rounded-2xl border border-[var(--border)] bg-slate-950/40 p-4">
                <div className="mb-3 flex items-center justify-between"><p className="text-sm font-medium text-white">{section.title}</p><span className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs text-slate-300">{items.length}</span></div>
                {items.length === 0 ? <p className="text-sm text-slate-500">Пусто.</p> : <div className="space-y-2">{items.map((item) => {
                  const isBusyForUser = actionKey?.endsWith(`:${item.otherUser.username}`) ?? false;
                  return <div key={item.id} className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-slate-950/55 p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium text-white">{item.otherUser.profile.displayName}</p><p className="font-mono text-xs text-cyan-100/75">@{item.otherUser.username}</p></div><div className="flex flex-wrap gap-2">{item.state === "INCOMING_REQUEST" ? <Button size="sm" onClick={() => void onAccept(item.otherUser.username)} disabled={isBusyForUser}>Принять</Button> : null}{item.state === "ACCEPTED" ? <Button size="sm" variant="secondary" onClick={() => void onOpenDm(item.otherUser.username)} disabled={isBusyForUser}>В чат</Button> : null}<Button size="sm" variant="secondary" onClick={() => void onRemove(item.otherUser.username)} disabled={isBusyForUser}>Удалить</Button><Button size="sm" variant="destructive" onClick={() => void onBlock(item.otherUser.username)} disabled={isBusyForUser}>Блок</Button></div></div>;
                })}</div>}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Блокировки</CardTitle>
          <CardDescription>Заблокированные пользователи не могут писать и звонить вам.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {blocks.length === 0 ? <p className="rounded-2xl border border-[var(--border)] bg-slate-950/40 p-4 text-sm text-slate-500">Список блокировок пуст.</p> : blocks.map((block) => (
            <div key={block.id} className="flex flex-col gap-2 rounded-2xl border border-[var(--border)] bg-slate-950/40 p-4">
              <div><p className="text-sm font-medium text-white">{block.blockedUser.profile.displayName}</p><p className="font-mono text-xs text-cyan-100/75">@{block.blockedUser.username}</p></div>
              <Button size="sm" variant="secondary" onClick={() => void onUnblock(block.blockedUser.username)} disabled={actionKey === `UNBLOCK:${block.blockedUser.username}`}>Разблокировать</Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
