import { adminOverviewResponseSchema } from "@lobby/shared";
import { ShieldCheck, Sparkles, UsersRound } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { fetchServerApi } from "@/lib/server-api";
import { requireAdminViewer } from "@/lib/server-session";

const roleLabels: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
};

const iconProps = { size: 18, strokeWidth: 1.5 } as const;

export default async function AdminPage() {
  await requireAdminViewer();
  const payload = await fetchServerApi("/v1/admin/overview");
  const overview = adminOverviewResponseSchema.parse(payload).overview;

  return (
    <div className="grid gap-4">
      <section className="premium-panel rounded-[24px] p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="eyebrow-pill">
                <ShieldCheck {...iconProps} />
                Admin
              </span>
              <span className="status-pill">
                <UsersRound {...iconProps} />
                Internal control
              </span>
            </div>
            <h1 className="mt-3 text-xl font-semibold tracking-tight text-white">
              Service control surface
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-dim)]">
              Operational metrics, recent invite activity and the fast links needed to
              keep Lobby healthy.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.72fr_0.28fr]">
        <section className="premium-panel rounded-[24px] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-white">Platform metrics</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                A compact read on the current platform footprint.
              </p>
            </div>
            <span className="status-pill">
              <Sparkles {...iconProps} />
              Live snapshot
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[
              ["Users", overview.counts.users],
              ["Blocked users", overview.counts.blockedUsers],
              ["Invites", overview.counts.invites],
              ["Hubs", overview.counts.hubs],
              ["Audit events", overview.counts.auditEvents],
            ].map(([label, value]) => (
              <div key={label} className="surface-subtle rounded-[18px] px-4 py-3">
                <p className="text-xs text-[var(--text-muted)]">{label}</p>
                <p className="mt-1 text-xl font-semibold text-white">{value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="premium-panel rounded-[24px] p-0">
          <div className="border-b border-[var(--border)] px-4 py-3">
            <p className="text-sm font-medium text-white">Recent invite keys</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              The latest onboarding channels issued from admin.
            </p>
          </div>

          <div className="min-h-0 overflow-y-auto">
            {overview.recentInvites.length === 0 ? (
              <EmptyState
                className="py-10"
                title="No invite keys yet"
                description="Create the first invite to start onboarding through the control surface."
              />
            ) : (
              overview.recentInvites.map((invite) => (
                <div
                  key={invite.id}
                  className="border-b border-[var(--border-soft)] px-4 py-3 transition-colors hover:bg-[var(--bg-hover)]"
                >
                  <p className="text-sm font-medium text-white">
                    {invite.label ?? "Untitled invite"}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-dim)]">
                    {roleLabels[invite.role] ?? invite.role} / {invite.usedCount}/{invite.maxUses}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
      </section>
    </div>
  );
}
