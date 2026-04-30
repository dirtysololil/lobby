"use client";

import Link from "next/link";
import { ShieldBan, ShieldCheck, UsersRound } from "lucide-react";
import {
  actionMessageSchema,
  adminUserSummarySchema,
  platformBlockSchema,
  type AdminUserListResponse,
  type PublicUser,
  type UserRole,
} from "@lobby/shared";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { CompactListMeta } from "@/components/ui/compact-list";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PresenceIndicator } from "@/components/ui/presence-indicator";
import { SelectField } from "@/components/ui/select-field";
import { UserAvatar } from "@/components/ui/user-avatar";
import { apiClientFetch } from "@/lib/api-client";
import { buildUserProfileHref } from "@/lib/profile-routes";

const iconProps = { size: 16, strokeWidth: 1.5 } as const;
const primaryActionClassName =
  "h-10 rounded-[14px] border-white bg-white px-4 text-black hover:border-white hover:bg-neutral-100";

const roleLabels: Record<UserRole, string> = {
  OWNER: "Владелец",
  ADMIN: "Администратор",
  MEMBER: "Участник",
};

const filterRoleOptions: Array<{ value: string; label: string }> = [
  { value: "", label: "Все роли" },
  { value: "OWNER", label: roleLabels.OWNER },
  { value: "ADMIN", label: roleLabels.ADMIN },
  { value: "MEMBER", label: roleLabels.MEMBER },
];

const blockedOptions = [
  { value: "all", label: "Все состояния" },
  { value: "blocked", label: "Заблокированные" },
  { value: "active", label: "Активные" },
];

interface UsersAdminPanelProps {
  viewer: PublicUser;
  response: AdminUserListResponse;
  filters: { query: string; role: string; blocked: string; page: number };
}

function getRoleRank(role: UserRole): number {
  switch (role) {
    case "OWNER":
      return 3;
    case "ADMIN":
      return 2;
    default:
      return 1;
  }
}

function getManageableRoleOptions(viewerRole: UserRole): UserRole[] {
  return viewerRole === "OWNER" ? ["OWNER", "ADMIN", "MEMBER"] : ["ADMIN", "MEMBER"];
}

export function UsersAdminPanel({
  viewer,
  response,
  filters,
}: UsersAdminPanelProps) {
  const router = useRouter();
  const [query, setQuery] = useState(filters.query);
  const [role, setRole] = useState(filters.role);
  const [blocked, setBlocked] = useState(filters.blocked);
  const [items, setItems] = useState(response.items);
  const [error, setError] = useState<string | null>(null);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [pendingAction, startTransition] = useTransition();
  const [roleDrafts, setRoleDrafts] = useState<Record<string, UserRole>>(() =>
    Object.fromEntries(response.items.map((item) => [item.user.id, item.user.role])),
  );

  useEffect(() => {
    setItems(response.items);
    setRoleDrafts(
      Object.fromEntries(response.items.map((item) => [item.user.id, item.user.role])),
    );
  }, [response.items]);

  const startIndex = response.total === 0 ? 0 : (response.page - 1) * response.pageSize + 1;
  const endIndex = Math.min(response.page * response.pageSize, response.total);
  const assignableRoles = getManageableRoleOptions(viewer.role);

  function pushFilters(nextPage = 1) {
    const params = new URLSearchParams();

    if (query) {
      params.set("query", query);
    }

    if (role) {
      params.set("role", role);
    }

    if (blocked) {
      params.set("blocked", blocked);
    }

    params.set("page", String(nextPage));

    startTransition(() => {
      router.push(`/app/admin/users?${params.toString()}`);
    });
  }

  async function handleModeration(userId: string, blockedState: boolean) {
    setError(null);
    setActionKey(`moderation:${userId}`);

    try {
      const payload = await apiClientFetch(
        blockedState
          ? `/v1/admin/users/${userId}/unblock`
          : `/v1/admin/users/${userId}/block`,
        {
          method: "POST",
          body: blockedState
            ? undefined
            : JSON.stringify({
                reason: "Блокировка из панели администрирования.",
              }),
        },
      );
      const nextPlatformBlock = blockedState ? null : platformBlockSchema.parse(payload);

      if (blockedState) {
        actionMessageSchema.parse(payload);
      }

      setItems((current) =>
        current.map((item) =>
          item.user.id === userId
            ? {
                ...item,
                activeSessionCount: blockedState ? item.activeSessionCount : 0,
                platformBlock: nextPlatformBlock,
              }
            : item,
        ),
      );
    } catch (moderationError) {
      setError(
        moderationError instanceof Error
          ? moderationError.message
          : "Не удалось обновить статус модерации.",
      );
    } finally {
      setActionKey(null);
    }
  }

  async function handleRoleSave(userId: string) {
    const nextRole = roleDrafts[userId];

    if (!nextRole) {
      return;
    }

    setError(null);
    setActionKey(`role:${userId}`);

    try {
      const payload = await apiClientFetch(`/v1/admin/users/${userId}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role: nextRole }),
      });
      const updatedUser = adminUserSummarySchema.parse(payload);

      setItems((current) =>
        current.map((item) => (item.user.id === userId ? updatedUser : item)),
      );
      setRoleDrafts((current) => ({
        ...current,
        [userId]: updatedUser.user.role,
      }));
    } catch (roleError) {
      setError(roleError instanceof Error ? roleError.message : "Не удалось сменить роль.");
    } finally {
      setActionKey(null);
    }
  }

  return (
    <div className="grid gap-3">
      <section className="premium-panel rounded-[24px] p-4 sm:p-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="eyebrow-pill">
              <UsersRound {...iconProps} />
              Пользователи
            </span>
            <CompactListMeta>
              <ShieldCheck {...iconProps} />
              {response.total} всего
            </CompactListMeta>
            <CompactListMeta>
              {startIndex}-{endIndex}
            </CompactListMeta>
          </div>

          <div>
            <h1 className="text-lg font-semibold tracking-tight text-white">
              Управление пользователями
            </h1>
            <p className="mt-1 text-sm text-[var(--text-dim)]">
              Поиск, роли и блокировки без лишних панелей.
            </p>
          </div>

          <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_180px_180px_auto]">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ник, почта или имя"
              className="h-10 rounded-[14px] border-white/8 bg-black px-3.5"
            />
            <SelectField
              value={role}
              onChange={(event) => setRole(event.target.value)}
              className="min-h-10"
            >
              {filterRoleOptions.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectField>
            <SelectField
              value={blocked}
              onChange={(event) => setBlocked(event.target.value)}
              className="min-h-10"
            >
              {blockedOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectField>
            <Button onClick={() => pushFilters()} disabled={pendingAction} className={primaryActionClassName}>
              {pendingAction ? "Применяем..." : "Применить"}
            </Button>
          </div>

          {error ? <p className="text-sm text-rose-200">{error}</p> : null}
        </div>
      </section>

      <section className="premium-panel overflow-hidden rounded-[24px]">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border-soft)] px-4 py-3">
          <div>
            <p className="text-sm font-medium text-white">Список пользователей</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Показано {startIndex}-{endIndex} из {response.total}
            </p>
          </div>
        </div>

        {items.length === 0 ? (
          <EmptyState
            className="min-h-[180px]"
            title="Ничего не найдено"
            description="Измените фильтры или расширьте запрос."
          />
        ) : (
          <div className="divide-y divide-[var(--border-soft)]">
            {items.map((item) => {
              const canManageUser =
                viewer.id !== item.user.id &&
                getRoleRank(viewer.role) > getRoleRank(item.user.role);
              const draftRole = roleDrafts[item.user.id] ?? item.user.role;
              const roleChanged = draftRole !== item.user.role;

              return (
                <div
                  key={item.user.id}
                  className="grid gap-3 px-4 py-3 transition-colors hover:bg-[var(--bg-hover)] xl:grid-cols-[minmax(0,1fr)_minmax(300px,360px)] xl:items-center"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <UserAvatar user={item.user} size="sm" />

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium text-white">
                          {item.user.profile.displayName}
                        </p>
                        <CompactListMeta>
                          {roleLabels[item.user.role] ?? item.user.role}
                        </CompactListMeta>
                        <PresenceIndicator user={item.user} compact />
                        {item.platformBlock ? (
                          <CompactListMeta className="border-red-500/20 bg-red-950/40 text-rose-200">
                            <ShieldBan {...iconProps} />
                            Заблокирован
                          </CompactListMeta>
                        ) : null}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--text-dim)]">
                        <span>@{item.user.username}</span>
                        <span className="text-[var(--text-muted)]">•</span>
                        <span className="break-all">{item.user.email}</span>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-muted)]">
                        <span>Сессии {item.activeSessionCount}</span>
                        <span>Хабы {item.hubMembershipCount}</span>
                        <span>
                          Активность{" "}
                          {item.lastSeenAt
                            ? new Date(item.lastSeenAt).toLocaleString("ru-RU")
                            : "никогда"}
                        </span>
                      </div>

                      {item.platformBlock ? (
                        <p className="mt-2 text-xs text-rose-200">
                          {item.platformBlock.reason ?? "Причина блокировки не указана."}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex w-full min-w-0 flex-wrap items-center gap-2 xl:max-w-[520px] xl:justify-end">
                    <div className="flex min-w-[220px] flex-1 items-center gap-2">
                      <SelectField
                        value={draftRole}
                        disabled={!canManageUser || actionKey === `role:${item.user.id}`}
                        onChange={(event) =>
                          setRoleDrafts((current) => ({
                            ...current,
                            [item.user.id]: event.target.value as UserRole,
                          }))
                        }
                        className="min-h-10 flex-1 rounded-[12px]"
                      >
                        {assignableRoles.map((roleOption) => (
                          <option key={roleOption} value={roleOption}>
                            {roleLabels[roleOption]}
                          </option>
                        ))}
                      </SelectField>

                      <Button
                        size="sm"
                        onClick={() => void handleRoleSave(item.user.id)}
                        disabled={
                          !canManageUser ||
                          !roleChanged ||
                          actionKey === `role:${item.user.id}`
                        }
                        className={
                          roleChanged
                            ? "h-10 rounded-[12px] border-white bg-white px-3.5 text-black hover:border-white hover:bg-neutral-100"
                            : "h-10 rounded-[12px] border-white/8 bg-black px-3.5 text-white hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)]"
                        }
                        variant={roleChanged ? "default" : "secondary"}
                      >
                        {actionKey === `role:${item.user.id}` ? "Сохраняем..." : "Роль"}
                      </Button>
                    </div>

                    <Link href={buildUserProfileHref(item.user.username)} className="min-w-[112px] flex-1 sm:flex-none">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-10 w-full rounded-[12px] border-white/8 bg-black px-3.5 hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)]"
                      >
                        Профиль
                      </Button>
                    </Link>

                    <Button
                      size="sm"
                      variant={item.platformBlock ? "secondary" : "destructive"}
                      onClick={() =>
                        void handleModeration(item.user.id, Boolean(item.platformBlock))
                      }
                      disabled={!canManageUser || actionKey === `moderation:${item.user.id}`}
                      className="h-10 min-w-[128px] flex-1 rounded-[12px] px-3.5 sm:flex-none"
                    >
                      {actionKey === `moderation:${item.user.id}`
                        ? "Обновляем..."
                        : item.platformBlock
                          ? "Снять блок"
                          : "Заблокировать"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-[var(--border-soft)] px-4 py-3">
          <Button
            variant="secondary"
            disabled={response.page <= 1 || pendingAction}
            onClick={() => pushFilters(response.page - 1)}
            className="h-10 rounded-[14px] border-white/8 bg-black px-4 hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)]"
          >
            Назад
          </Button>
          <Button
            variant="secondary"
            disabled={response.page * response.pageSize >= response.total || pendingAction}
            onClick={() => pushFilters(response.page + 1)}
            className="h-10 rounded-[14px] border-white/8 bg-black px-4 hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)]"
          >
            Дальше
          </Button>
        </div>
      </section>
    </div>
  );
}
