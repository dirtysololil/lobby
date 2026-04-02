import { adminOverviewResponseSchema } from "@lobby/shared";
import { AdminNav } from "@/components/admin/admin-nav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchServerApi } from "@/lib/server-api";
import { requireAdminViewer } from "@/lib/server-session";

export default async function AdminPage() {
  await requireAdminViewer();
  const payload = await fetchServerApi("/v1/admin/overview");
  const overview = adminOverviewResponseSchema.parse(payload).overview;

  return (
    <div className="grid gap-6">
      <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 shadow-[var(--shadow)] backdrop-blur-xl">
        <p className="font-mono text-xs uppercase tracking-[0.26em] text-sky-200/70">Admin dashboard</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">Owner and admin controls</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
          Moderate users, manage invite keys and review critical audit events without leaving the app shell.
        </p>
      </section>

      <AdminNav />

      <section className="grid gap-6 xl:grid-cols-[0.72fr_0.28fr]">
        <Card>
          <CardHeader>
            <CardTitle>Platform health</CardTitle>
            <CardDescription>Current moderation and onboarding snapshot.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[
              ["Users", overview.counts.users],
              ["Blocked users", overview.counts.blockedUsers],
              ["Invites", overview.counts.invites],
              ["Hubs", overview.counts.hubs],
              ["Audit events", overview.counts.auditEvents],
            ].map(([label, value]) => (
              <div key={label} className="rounded-3xl border border-white/10 bg-slate-950/35 p-5">
                <p className="text-sm text-slate-400">{label}</p>
                <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent invites</CardTitle>
            <CardDescription>Latest keys created in the platform.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {overview.recentInvites.map((invite) => (
              <div key={invite.id} className="rounded-3xl border border-white/10 bg-slate-950/35 p-4">
                <p className="text-sm font-medium text-white">{invite.label ?? "Unnamed invite"}</p>
                <p className="mt-2 text-sm text-slate-400">
                  {invite.role} · {invite.usedCount}/{invite.maxUses}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
