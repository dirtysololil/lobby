"use client";

import type { AdminUserListResponse } from "@lobby/shared";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClientFetch } from "@/lib/api-client";

interface UsersAdminPanelProps { response: AdminUserListResponse; filters: { query: string; role: string; blocked: string; page: number; }; }

export function UsersAdminPanel({ response, filters }: UsersAdminPanelProps) {
  const router = useRouter();
  const [query, setQuery] = useState(filters.query);
  const [role, setRole] = useState(filters.role);
  const [blocked, setBlocked] = useState(filters.blocked);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, startTransition] = useTransition();

  function pushFilters(nextPage = 1) {
    const params = new URLSearchParams();
    if (query) params.set("query", query);
    if (role) params.set("role", role);
    if (blocked) params.set("blocked", blocked);
    params.set("page", String(nextPage));
    startTransition(() => { router.push(`/app/admin/users?${params.toString()}`); });
  }

  async function handleModeration(userId: string, blockedState: boolean) {
    setError(null);
    try {
      await apiClientFetch(blockedState ? `/v1/admin/users/${userId}/unblock` : `/v1/admin/users/${userId}/block`, { method: "POST", body: blockedState ? undefined : JSON.stringify({ reason: "Заблокирован через административную консоль" }) });
      router.refresh();
    } catch (moderationError) {
      setError(moderationError instanceof Error ? moderationError.message : "Не удалось выполнить модерацию");
    }
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)]">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-200/70">Модерация пользователей</p>
        <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_170px_170px_auto]">
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск: username, email, имя" />
          <select className="h-11 rounded-2xl border border-[var(--border)] bg-slate-950/65 px-4 text-sm text-white outline-none" value={role} onChange={(event) => setRole(event.target.value)}>
            <option value="">Все роли</option><option value="OWNER">OWNER</option><option value="ADMIN">ADMIN</option><option value="MEMBER">MEMBER</option>
          </select>
          <select className="h-11 rounded-2xl border border-[var(--border)] bg-slate-950/65 px-4 text-sm text-white outline-none" value={blocked} onChange={(event) => setBlocked(event.target.value)}>
            <option value="all">Все</option><option value="blocked">Только блок</option><option value="active">Только активные</option>
          </select>
          <Button onClick={() => pushFilters()} disabled={pendingAction}>{pendingAction ? "Применяем..." : "Применить"}</Button>
        </div>
        {error ? <p className="mt-3 text-sm text-rose-200">{error}</p> : null}
      </section>

      <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)]">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-200/70">Пользователи</p>
        <div className="mt-4 grid gap-3">
          {response.items.length === 0 ? <EmptyState title="Ничего не найдено" description="Измените фильтры или расширьте поисковый запрос." /> : response.items.map((item) => (
            <div key={item.user.id} className="grid gap-4 rounded-2xl border border-[var(--border)] bg-slate-950/40 p-4 xl:grid-cols-[minmax(0,1fr)_210px]">
              <div className="flex items-start gap-3">
                <UserAvatar user={item.user} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><p className="text-base font-medium text-white">{item.user.profile.displayName}</p><span className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[11px] uppercase tracking-[0.15em] text-cyan-100/80">{item.user.role}</span>{item.platformBlock ? <span className="rounded-full border border-rose-300/20 bg-rose-400/[0.08] px-2.5 py-1 text-[11px] uppercase tracking-[0.15em] text-rose-200">Блок</span> : null}</div>
                  <p className="mt-1 font-mono text-sm text-slate-300">@{item.user.username}</p>
                  <p className="mt-1 text-sm text-slate-400">{item.user.email}</p>
                  <p className="mt-2 text-sm text-slate-400">Сессии: {item.activeSessionCount} · Хабы: {item.hubMembershipCount} · Последняя активность: {item.lastSeenAt ? new Date(item.lastSeenAt).toLocaleString() : "никогда"}</p>
                  {item.platformBlock ? <p className="mt-2 text-sm text-rose-200">{item.platformBlock.reason ?? "Причина не указана"}</p> : null}
                </div>
              </div>
              <div className="flex items-center justify-end"><Button variant={item.platformBlock ? "secondary" : "destructive"} onClick={() => void handleModeration(item.user.id, Boolean(item.platformBlock))}>{item.platformBlock ? "Снять блок" : "Заблокировать"}</Button></div>
            </div>
          ))}
        </div>
        <div className="mt-5 flex flex-col gap-3 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <span>Показано {(response.page - 1) * response.pageSize + 1} - {Math.min(response.page * response.pageSize, response.total)} из {response.total}</span>
          <div className="flex gap-2"><Button variant="secondary" disabled={response.page <= 1 || pendingAction} onClick={() => pushFilters(response.page - 1)}>Назад</Button><Button variant="secondary" disabled={response.page * response.pageSize >= response.total || pendingAction} onClick={() => pushFilters(response.page + 1)}>Дальше</Button></div>
        </div>
      </section>
    </div>
  );
}
