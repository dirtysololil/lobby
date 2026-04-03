import Link from "next/link";
import { ArrowRight, Layers3, MessageSquare, Settings2, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserAvatar } from "@/components/ui/user-avatar";
import { requireViewer } from "@/lib/server-session";

export default async function AppPage() {
  const viewer = await requireViewer();
  const isAdmin = viewer.role === "OWNER" || viewer.role === "ADMIN";

  return (
    <section className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card>
        <CardHeader>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Панель</p>
          <CardTitle>Добро пожаловать в Lobby</CardTitle>
          <CardDescription>Единая рабочая зона для сообщений, хабов, форумов и звонков.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-3xl border border-[var(--border)] bg-[#0b1322]/70 p-5"><ShieldCheck className="mb-3 h-5 w-5 text-cyan-200" /><p className="text-sm text-[var(--text-dim)]">Роль</p><p className="mt-1 text-lg font-medium text-white">{viewer.role}</p></div>
          <div className="rounded-3xl border border-[var(--border)] bg-[#0b1322]/70 p-5"><Sparkles className="mb-3 h-5 w-5 text-cyan-200" /><p className="text-sm text-[var(--text-dim)]">Пресет аватара</p><p className="mt-1 text-lg font-medium text-white">{viewer.profile.avatarPreset}</p></div>
          <div className="rounded-3xl border border-[var(--border)] bg-[#0b1322]/70 p-5"><MessageSquare className="mb-3 h-5 w-5 text-cyan-200" /><p className="text-sm text-[var(--text-dim)]">Статус</p><p className="mt-1 text-lg font-medium text-white">{viewer.profile.presence}</p></div>
        </CardContent>
      </Card>

      <div className="grid gap-5">
        <Card>
          <CardHeader><CardTitle>Аккаунт</CardTitle><CardDescription>Ваш публичный профиль внутри Lobby.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 rounded-3xl border border-[var(--border)] bg-[#0b1322]/70 p-5">
              <UserAvatar user={viewer} size="lg" />
              <div>
                <p className="text-lg font-medium text-white">{viewer.profile.displayName}</p>
                <p className="mt-1 font-mono text-sm text-slate-300">@{viewer.username}</p>
                <p className="mt-2 text-sm text-[var(--text-dim)]">{viewer.email}</p>
              </div>
            </div>
            <p className="rounded-3xl border border-[var(--border)] bg-[#0b1322]/70 p-4 text-sm text-slate-300">{viewer.profile.bio ?? "Описание профиля пока не заполнено."}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Быстрые переходы</CardTitle></CardHeader>
          <CardContent className="grid gap-2.5">
            <Link href="/app/messages"><Button className="w-full justify-between" variant="secondary">Открыть сообщения <MessageSquare className="h-4 w-4" /></Button></Link>
            <Link href="/app/hubs"><Button className="w-full justify-between" variant="secondary">Перейти к хабам <Layers3 className="h-4 w-4" /></Button></Link>
            <Link href="/app/settings/profile"><Button className="w-full justify-between" variant="secondary">Настройки профиля <Settings2 className="h-4 w-4" /></Button></Link>
            {isAdmin ? <Link href="/app/admin"><Button className="w-full justify-between" variant="secondary">Админ-панель <ShieldCheck className="h-4 w-4" /></Button></Link> : null}
            <Link href="/app/settings/notifications"><Button className="w-full justify-between" variant="secondary">Уведомления <ArrowRight className="h-4 w-4" /></Button></Link>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
