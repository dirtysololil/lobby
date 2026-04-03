import { adminOverviewResponseSchema } from "@lobby/shared";
import { ShieldCheck, Sparkles } from "lucide-react";
import { AdminNav } from "@/components/admin/admin-nav";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    <div className="grid gap-6">
      <section className="premium-panel rounded-[32px] p-6 lg:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="section-kicker">Админ-панель</p>
            <h1 className="mt-4 font-[var(--font-heading)] text-3xl font-semibold tracking-[-0.04em] text-white">
              Управление платформой
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--text-dim)]">
              Модерируйте пользователей, управляйте ключами и проверяйте события
              аудита в одном интерфейсе.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="eyebrow-pill">
              <ShieldCheck className="h-3.5 w-3.5" /> Приватный контроль
            </span>
            <span className="status-pill">
              <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
              Статусный внутренний центр
            </span>
          </div>
        </div>
      </section>

      <AdminNav />

      <section className="grid gap-6 xl:grid-cols-[0.72fr_0.28fr]">
        <Card>
          <CardHeader>
            <CardTitle>Состояние платформы</CardTitle>
            <CardDescription>
              Актуальные показатели модерации и онбординга.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[
              ["Пользователи", overview.counts.users],
              ["Заблокированные", overview.counts.blockedUsers],
              ["Ключи", overview.counts.invites],
              ["Хабы", overview.counts.hubs],
              ["События аудита", overview.counts.auditEvents],
            ].map(([label, value]) => (
              <div key={label} className="metric-tile rounded-[26px] p-5">
                <p className="text-sm text-[var(--text-dim)]">{label}</p>
                <p className="mt-2 text-3xl font-semibold text-white">
                  {value}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Последние ключи</CardTitle>
            <CardDescription>Недавно созданные ключи доступа.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {overview.recentInvites.map((invite) => (
              <div
                key={invite.id}
                className="surface-subtle rounded-[24px] p-4"
              >
                <p className="text-sm font-medium text-white">
                  {invite.label ?? "Ключ без названия"}
                </p>
                <p className="mt-2 text-sm text-[var(--text-dim)]">
                  {roleLabels[invite.role] ?? invite.role} · {invite.usedCount}/
                  {invite.maxUses}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
