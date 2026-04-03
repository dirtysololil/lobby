"use client";

import { ShieldBan, ShieldCheck, UsersRound } from "lucide-react";
import type { AdminUserListResponse } from "@lobby/shared";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClientFetch } from "@/lib/api-client";

const iconProps = { size: 18, strokeWidth: 1.5 } as const;

const roleLabels: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
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

  const startIndex = response.total === 0 ? 0 : (response.page - 1) * response.pageSize + 1;
  const endIndex = Math.min(response.page * response.pageSize, response.total);

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
                reason: "Blocked from the admin control surface.",
              }),
        },
      );
      router.refresh();
    } catch (moderationError) {
      setError(
        moderationError instanceof Error
          ? moderationError.message
          : "Unable to update moderation status.",
      );
    }
  }

  return (
    <div className="grid gap-4">
      <section className="premium-panel rounded-[24px] p-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="eyebrow-pill">
                <UsersRound {...iconProps} />
                User control
              </span>
              <span className="status-pill">
                <ShieldCheck {...iconProps} />
                {response.total} indexed
              </span>
            </div>
            <h1 className="mt-3 text-xl font-semibold tracking-tight text-white">
              Platform members
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-dim)]">
              Search, review and moderate the people behind daily communication flows.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 xl:grid-cols-[minmax(0,1fr)_160px_160px_auto]">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by username, email or display name"
          />
          <select
            className="field-select text-sm"
            value={role}
            onChange={(event) => setRole(event.target.value)}
          >
            <option value="">All roles</option>
            <option value="OWNER">Owner</option>
            <option value="ADMIN">Admin</option>
            <option value="MEMBER">Member</option>
          </select>
          <select
            className="field-select text-sm"
            value={blocked}
            onChange={(event) => setBlocked(event.target.value)}
          >
            <option value="all">All states</option>
            <option value="blocked">Blocked only</option>
            <option value="active">Active only</option>
          </select>
          <Button onClick={() => pushFilters()} disabled={pendingAction}>
            {pendingAction ? "Applying..." : "Apply"}
          </Button>
        </div>

        {error ? <p className="mt-4 text-sm text-rose-200">{error}</p> : null}
      </section>

      <section className="premium-panel rounded-[24px] p-0">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
          <div>
            <p className="text-sm font-medium text-white">Moderation queue</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Showing {startIndex}-{endIndex} of {response.total}
            </p>
          </div>
        </div>

        <div className="min-h-0 overflow-y-auto">
          {response.items.length === 0 ? (
            <EmptyState
              className="py-10"
              title="No matching members"
              description="Adjust the filters or broaden the query to load more results."
            />
          ) : (
            response.items.map((item) => (
              <div
                key={item.user.id}
                className="group flex flex-col gap-3 border-b border-[var(--border-soft)] px-4 py-3 transition-colors hover:bg-[var(--bg-hover)] lg:flex-row lg:items-center lg:justify-between"
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
                      {item.platformBlock ? (
                        <span className="status-pill text-rose-200">
                          <ShieldBan {...iconProps} />
                          Blocked
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      @{item.user.username}
                    </p>
                    <p className="mt-1 text-sm text-[var(--text-dim)]">{item.user.email}</p>
                    <p className="mt-2 text-xs text-[var(--text-dim)]">
                      Sessions {item.activeSessionCount} / Hubs {item.hubMembershipCount} / Last seen{" "}
                      {item.lastSeenAt
                        ? new Date(item.lastSeenAt).toLocaleString()
                        : "Never"}
                    </p>
                    {item.platformBlock ? (
                      <p className="mt-2 text-xs text-rose-200">
                        {item.platformBlock.reason ?? "No block reason provided."}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 lg:opacity-0 lg:transition-opacity lg:group-hover:opacity-100 lg:group-focus-within:opacity-100">
                  <Button
                    size="sm"
                    variant={item.platformBlock ? "secondary" : "destructive"}
                    onClick={() =>
                      void handleModeration(item.user.id, Boolean(item.platformBlock))
                    }
                  >
                    {item.platformBlock ? "Remove block" : "Block account"}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex flex-col gap-3 px-4 py-3 text-sm text-[var(--text-dim)] sm:flex-row sm:items-center sm:justify-between">
          <span>Move through the queue without leaving the current admin context.</span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              disabled={response.page <= 1 || pendingAction}
              onClick={() => pushFilters(response.page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              disabled={
                response.page * response.pageSize >= response.total || pendingAction
              }
              onClick={() => pushFilters(response.page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
