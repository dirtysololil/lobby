import { adminOverviewResponseSchema } from "@lobby/shared";
import { ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchServerApi } from "@/lib/server-api";
import { requireAdminViewer } from "@/lib/server-session";

const roleLabels: Record<string, string> = {
  OWNER: "Владелец",
  ADMIN: "Администратор",
  MEMBER: "Участник",
};

export default async function AdminPage() {
  await requireAdminViewer();
  const payload = await fetchServerApi("/v1/admin/overview");
  const overview = adminOverviewResponseSchema.parse(payload).overview;

  return (
    <div className="grid gap-4">
      <section className="social-shell rounded-[20px] p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow-pill">
            <ShieldCheck className="h-3.5 w-3.5" />
            Admin
          </span>
          <span className="status-pill">Internal</span>
        </div>
        <h1 className="mt-1.5 font-[var(--font-heading)] text-[1.1rem] font-semibold tracking-[-0.04em] text-white">
          Операционный контур
        </h1>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.72fr_0.28fr]">
        <Card>
          <CardHeader>
            <CardTitle>Показатели</CardTitle>
            <CardDescription>Текущие цифры по платформе.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[
              ["Пользователи", overview.counts.users],
              ["Заблокированные", overview.counts.blockedUsers],
              ["Ключи", overview.counts.invites],
              ["Хабы", overview.counts.hubs],
              ["События аудита", overview.counts.auditEvents],
            ].map(([label, value]) => (
              <div key={label} className="metric-tile rounded-[16px] p-3">
                <p className="text-sm text-[var(--text-dim)]">{label}</p>
                <p className="mt-1.5 text-xl font-semibold text-white">{value}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Последние ключи</CardTitle>
            <CardDescription>Недавно созданные приглашения.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {overview.recentInvites.map((invite) => (
              <div key={invite.id} className="surface-subtle rounded-[16px] p-3">
                <p className="text-sm font-semibold text-white">
                  {invite.label ?? "Ключ без названия"}
                </p>
                <p className="mt-1 text-sm text-[var(--text-dim)]">
                  {roleLabels[invite.role] ?? invite.role} · {invite.usedCount}/{invite.maxUses}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
