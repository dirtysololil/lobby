"use client";

import type { AdminUserListResponse } from "@lobby/shared";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClientFetch } from "@/lib/api-client";

interface UsersAdminPanelProps {
  response: AdminUserListResponse;
  filters: {
    query: string;
    role: string;
    blocked: string;
    page: number;
  };
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

    try {
      await apiClientFetch(blockedState ? `/v1/admin/users/${userId}/unblock` : `/v1/admin/users/${userId}/block`, {
        method: "POST",
        body: blockedState ? undefined : JSON.stringify({ reason: "Blocked from admin dashboard" }),
      });
      router.refresh();
    } catch (moderationError) {
      setError(moderationError instanceof Error ? moderationError.message : "Moderation action failed");
    }
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 shadow-[var(--shadow)] backdrop-blur-xl">
        <p className="font-mono text-xs uppercase tracking-[0.26em] text-sky-200/70">User moderation</p>
        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px_180px_auto]">
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search username, email, display name" />
          <select
            className="h-12 rounded-2xl border border-white/10 bg-slate-950/50 px-4 text-sm text-white outline-none"
            value={role}
            onChange={(event) => setRole(event.target.value)}
          >
            <option value="">All roles</option>
            <option value="OWNER">OWNER</option>
            <option value="ADMIN">ADMIN</option>
            <option value="MEMBER">MEMBER</option>
          </select>
          <select
            className="h-12 rounded-2xl border border-white/10 bg-slate-950/50 px-4 text-sm text-white outline-none"
            value={blocked}
            onChange={(event) => setBlocked(event.target.value)}
          >
            <option value="all">All users</option>
            <option value="blocked">Blocked only</option>
            <option value="active">Active only</option>
          </select>
          <Button onClick={() => pushFilters()} disabled={pendingAction}>
            {pendingAction ? "Loading..." : "Apply filters"}
          </Button>
        </div>
        {error ? <p className="mt-4 text-sm text-rose-200">{error}</p> : null}
      </section>

      <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 shadow-[var(--shadow)] backdrop-blur-xl">
        <p className="font-mono text-xs uppercase tracking-[0.26em] text-sky-200/70">Users</p>
        <div className="mt-6 grid gap-4">
          {response.items.length === 0 ? (
            <EmptyState
              title="No users matched the current filters"
              description="Try a wider query or switch the blocked/role filters."
            />
          ) : (
            response.items.map((item) => (
              <div
                key={item.user.id}
                className="grid gap-5 rounded-3xl border border-white/10 bg-slate-950/35 p-5 lg:grid-cols-[minmax(0,1fr)_220px]"
              >
                <div className="flex items-start gap-4">
                  <UserAvatar user={item.user} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="text-base font-medium text-white">{item.user.profile.displayName}</p>
                      <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-sky-200/80">
                        {item.user.role}
                      </span>
                      {item.platformBlock ? (
                        <span className="rounded-full border border-rose-300/20 bg-rose-400/[0.08] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-rose-200">
                          Blocked
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 font-mono text-sm text-slate-300">@{item.user.username}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{item.user.email}</p>
                    <p className="mt-4 text-sm leading-6 text-slate-400">
                      Sessions {item.activeSessionCount} · Hub memberships {item.hubMembershipCount} · Last seen{" "}
                      {item.lastSeenAt ? new Date(item.lastSeenAt).toLocaleString() : "never"}
                    </p>
                    {item.platformBlock ? (
                      <p className="mt-2 text-sm leading-6 text-rose-200">
                        {item.platformBlock.reason ?? "No moderation reason attached"}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center justify-end">
                  <Button
                    variant={item.platformBlock ? "secondary" : "destructive"}
                    onClick={() => void handleModeration(item.user.id, Boolean(item.platformBlock))}
                  >
                    {item.platformBlock ? "Unblock user" : "Block user"}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="mt-6 flex items-center justify-between text-sm text-slate-400">
          <span>
            Showing {(response.page - 1) * response.pageSize + 1}
            {" - "}
            {Math.min(response.page * response.pageSize, response.total)} of {response.total}
          </span>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              disabled={response.page <= 1 || pendingAction}
              onClick={() => pushFilters(response.page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              disabled={response.page * response.pageSize >= response.total || pendingAction}
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
