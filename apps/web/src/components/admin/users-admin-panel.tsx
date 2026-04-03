"use client";

import { ShieldBan, ShieldCheck, Sparkles, UsersRound } from "lucide-react";
import type { AdminUserListResponse } from "@lobby/shared";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClientFetch } from "@/lib/api-client";

const roleLabels: Record<string, string> = {
  OWNER: "Владелец",
  ADMIN: "Администратор",
  MEMBER: "Участник",
};

interface UsersAdminPanelProps {
  response: AdminUserListResponse;
  filters: { query: string; role: string; blocked: string; page: number };
}

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
    startTransition(() => {
      router.push(`/app/admin/users?${params.toString()}`);
    });
  }

  async function handleModeration(userId: string, blockedState: boolean) {
    setError(null);
    try {
      await apiClientFetch(
        blockedState
          ? `/v1/admin/users/${userId}/unblock`
          : `/v1/admin/users/${userId}/block`,
        {
          method: "POST",
          body: blockedState
            ? undefined
            : JSON.stringify({
                reason: "Заблокирован через административную консоль",
              }),
        },
      );
      router.refresh();
    } catch (moderationError) {
      setError(
        moderationError instanceof Error
          ? moderationError.message
          : "Не удалось выполнить модерацию",
      );
    }
  }

  return (
    <div className="grid gap-4">
      <section className="social-shell rounded-[20px] p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="section-kicker">Control</p>
            <h2 className="mt-1.5 font-[var(--font-heading)] text-[1.15rem] font-semibold tracking-[-0.04em] text-white">
              Модерация пользователей
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="eyebrow-pill">
              <UsersRound className="h-3.5 w-3.5" /> Пользователи
            </span>
            <span className="status-pill">
              <ShieldCheck className="h-3.5 w-3.5 text-[var(--success)]" />
              Системный контроль активен
            </span>
          </div>
        </div>
        <div className="mt-3 grid gap-2.5 xl:grid-cols-[minmax(0,1fr)_156px_156px_auto]">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск: username, email, имя"
          />
          <select
            className="field-select text-sm"
            value={role}
            onChange={(event) => setRole(event.target.value)}
          >
            <option value="">Все роли</option>
            <option value="OWNER">Владелец</option>
            <option value="ADMIN">Администратор</option>
            <option value="MEMBER">Участник</option>
          </select>
          <select
            className="field-select text-sm"
            value={blocked}
            onChange={(event) => setBlocked(event.target.value)}
          >
            <option value="all">Все</option>
            <option value="blocked">Только блок</option>
            <option value="active">Только активные</option>
          </select>
          <Button onClick={() => pushFilters()} disabled={pendingAction}>
            {pendingAction ? "Применяем..." : "Применить"}
          </Button>
        </div>
        {error ? <p className="mt-3 text-sm text-rose-200">{error}</p> : null}
      </section>

      <section className="social-shell rounded-[20px] p-3.5">
        <p className="section-kicker">Пользователи платформы</p>
        <div className="mt-3 grid gap-2">
          {response.items.length === 0 ? (
            <EmptyState
              title="Ничего не найдено"
              description="Измените фильтры или расширьте поисковый запрос."
            />
          ) : (
            response.items.map((item) => (
              <div
                key={item.user.id}
                className="list-row grid gap-3 rounded-[16px] p-3 xl:grid-cols-[minmax(0,1fr)_190px]"
              >
                <div className="flex items-start gap-3">
                  <UserAvatar user={item.user} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-white">
                        {item.user.profile.displayName}
                      </p>
                      <span className="glass-badge">
                        {roleLabels[item.user.role] ?? item.user.role}
                      </span>
                      {item.platformBlock ? (
                        <span className="glass-badge">
                          <ShieldBan className="h-3 w-3" />
                          Блок
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 font-mono text-sm text-slate-300">
                      @{item.user.username}
                    </p>
                    <p className="mt-1 text-sm text-[var(--text-dim)]">
                      {item.user.email}
                    </p>
                    <p className="mt-1.5 text-sm text-[var(--text-dim)]">
                      Сессии: {item.activeSessionCount} · Хабы:{" "}
                      {item.hubMembershipCount} · Последняя активность:{" "}
                      {item.lastSeenAt
                        ? new Date(item.lastSeenAt).toLocaleString()
                        : "никогда"}
                    </p>
                    {item.platformBlock ? (
                      <p className="mt-2 text-sm text-rose-200">
                        {item.platformBlock.reason ?? "Причина не указана"}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center justify-end">
                  <Button
                    variant={item.platformBlock ? "secondary" : "destructive"}
                    onClick={() =>
                      void handleModeration(
                        item.user.id,
                        Boolean(item.platformBlock),
                      )
                    }
                  >
                    {item.platformBlock ? "Снять блок" : "Заблокировать"}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="mt-5 flex flex-col gap-3 text-sm text-[var(--text-dim)] sm:flex-row sm:items-center sm:justify-between">
          <span>
            Показано {(response.page - 1) * response.pageSize + 1} -{" "}
            {Math.min(response.page * response.pageSize, response.total)} из{" "}
            {response.total}
          </span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              disabled={response.page <= 1 || pendingAction}
              onClick={() => pushFilters(response.page - 1)}
            >
              Назад
            </Button>
            <Button
              variant="secondary"
              disabled={
                response.page * response.pageSize >= response.total ||
                pendingAction
              }
              onClick={() => pushFilters(response.page + 1)}
            >
              Дальше
            </Button>
          </div>
        </div>
        <div className="surface-subtle mt-4 rounded-[16px] px-3 py-2.5 text-sm text-[var(--text-dim)]">
          <span className="inline-flex items-center gap-2 text-white">
            <Sparkles className="h-4 w-4 text-[var(--accent)]" />
            Внутренний маршрут без лишнего UI.
          </span>
        </div>
      </section>
    </div>
  );
}
