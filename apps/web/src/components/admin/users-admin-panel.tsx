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
import { EmptyState } from "@/components/ui/empty-state";
import { PresenceIndicator } from "@/components/ui/presence-indicator";
import { SelectField } from "@/components/ui/select-field";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClientFetch } from "@/lib/api-client";
import { buildUserProfileHref } from "@/lib/profile-routes";

const iconProps = { size: 18, strokeWidth: 1.5 } as const;

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
  { value: "blocked", label: "Только заблокированные" },
  { value: "active", label: "Только активные" },
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
    <div className="grid gap-4">
      <section className="premium-panel rounded-[26px] p-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="eyebrow-pill">
                <UsersRound {...iconProps} />
                Пользователи
              </span>
              <span className="status-pill">
                <ShieldCheck {...iconProps} />
                {response.total} в индексе
              </span>
            </div>
            <h1 className="mt-3 text-xl font-semibold tracking-tight text-white">
              Управление участниками платформы
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-dim)]">
              Ищите пользователей, меняйте роли и управляйте блокировками из одной
              компактной панели.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 xl:grid-cols-[minmax(0,1fr)_190px_190px_auto]">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск по нику, почте или имени"
          />
          <SelectField value={role} onChange={(event) => setRole(event.target.value)}>
            {filterRoleOptions.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>
          <SelectField value={blocked} onChange={(event) => setBlocked(event.target.value)}>
            {blockedOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>
          <Button onClick={() => pushFilters()} disabled={pendingAction}>
            {pendingAction ? "Применяем..." : "Применить"}
          </Button>
        </div>

        {error ? <p className="mt-4 text-sm text-rose-200">{error}</p> : null}
      </section>

      <section className="premium-panel rounded-[26px] p-0">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
          <div>
            <p className="text-sm font-medium text-white">Список модерации</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Показано {startIndex}-{endIndex} из {response.total}
            </p>
          </div>
        </div>

        <div className="min-h-0 overflow-y-auto">
          {items.length === 0 ? (
            <EmptyState
              className="py-10"
              title="Ничего не найдено"
              description="Измените фильтры или расширьте запрос, чтобы увидеть больше пользователей."
            />
          ) : (
            items.map((item) => {
              const canManageUser =
                viewer.id !== item.user.id &&
                getRoleRank(viewer.role) > getRoleRank(item.user.role);
              const draftRole = roleDrafts[item.user.id] ?? item.user.role;
              const roleChanged = draftRole !== item.user.role;
              return (
                <div
                  key={item.user.id}
                  className="group flex flex-col gap-3 border-b border-[var(--border-soft)] px-4 py-3 transition-colors hover:bg-[var(--bg-hover)] xl:flex-row xl:items-center xl:justify-between"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <UserAvatar user={item.user} size="sm" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium text-white">
                          {item.user.profile.displayName}
                        </p>
                        <span className="glass-badge">
                          {roleLabels[item.user.role] ?? item.user.role}
                        </span>
                        <PresenceIndicator user={item.user} compact />
                        {item.platformBlock ? (
                          <span className="status-pill text-rose-200">
                            <ShieldBan {...iconProps} />
                            Заблокирован
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        @{item.user.username}
                      </p>
                      <p className="mt-1 text-sm text-[var(--text-dim)]">{item.user.email}</p>
                      <p className="mt-2 text-xs text-[var(--text-dim)]">
                        Активных сессий {item.activeSessionCount} · Хабов {item.hubMembershipCount}
                        {" · "}
                        Последняя активность{" "}
                        {item.lastSeenAt
                          ? new Date(item.lastSeenAt).toLocaleString("ru-RU")
                          : "никогда"}
                      </p>
                      {item.platformBlock ? (
                        <p className="mt-2 text-xs text-rose-200">
                          {item.platformBlock.reason ?? "Причина блокировки не указана."}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex w-full flex-col gap-2 rounded-[18px] border border-[var(--border-soft)] bg-white/[0.03] p-2.5 xl:w-[340px]">
                    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                      <SelectField
                        value={draftRole}
                        disabled={!canManageUser || actionKey === `role:${item.user.id}`}
                        onChange={(event) =>
                          setRoleDrafts((current) => ({
                            ...current,
                            [item.user.id]: event.target.value as UserRole,
                          }))
                        }
                      >
                        {assignableRoles.map((roleOption) => (
                          <option key={roleOption} value={roleOption}>
                            {roleLabels[roleOption]}
                          </option>
                        ))}
                      </SelectField>
                      <Button
                        size="sm"
                        variant={roleChanged ? "default" : "secondary"}
                        onClick={() => void handleRoleSave(item.user.id)}
                        disabled={
                          !canManageUser ||
                          !roleChanged ||
                          actionKey === `role:${item.user.id}`
                        }
                        className="h-10 px-3"
                      >
                        {actionKey === `role:${item.user.id}` ? "Сохраняем..." : "Применить роль"}
                      </Button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Link href={buildUserProfileHref(item.user.username)}>
                        <Button size="sm" variant="secondary">
                          Профиль
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        variant={item.platformBlock ? "secondary" : "destructive"}
                        onClick={() =>
                          void handleModeration(item.user.id, Boolean(item.platformBlock))
                        }
                        disabled={
                          !canManageUser || actionKey === `moderation:${item.user.id}`
                        }
                      >
                        {actionKey === `moderation:${item.user.id}`
                          ? "Обновляем..."
                          : item.platformBlock
                            ? "Снять блок"
                            : "Заблокировать"}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex justify-end gap-2 px-4 py-3">
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
                response.page * response.pageSize >= response.total || pendingAction
              }
              onClick={() => pushFilters(response.page + 1)}
            >
              Дальше
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
