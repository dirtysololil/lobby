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
    <section className="grid gap-6 xl:grid-cols-[0.72fr_0.28fr]">
      <Card>
        <CardHeader>
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-sky-200/70">Dashboard</p>
          <CardTitle>Lobby workspace is active</CardTitle>
          <CardDescription>
            Invite-only auth, private messaging, hubs, forum, LiveKit calls, avatar presets and moderation
            tooling are connected in one modular shell.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-5">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-300/10 text-sky-300">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <p className="text-sm text-slate-400">Role</p>
            <p className="mt-1 text-lg font-medium text-white">{viewer.role}</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-5">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-300/10 text-sky-300">
              <Sparkles className="h-5 w-5" />
            </div>
            <p className="text-sm text-slate-400">Avatar preset</p>
            <p className="mt-1 text-lg font-medium text-white">{viewer.profile.avatarPreset}</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-5">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-300/10 text-sky-300">
              <MessageSquare className="h-5 w-5" />
            </div>
            <p className="text-sm text-slate-400">Presence</p>
            <p className="mt-1 text-lg font-medium text-white">{viewer.profile.presence}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Current account</CardTitle>
            <CardDescription>Public identity and avatar customization state.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="flex items-center gap-4 rounded-3xl border border-white/10 bg-slate-950/35 p-5">
              <UserAvatar user={viewer} size="lg" />
              <div>
                <p className="text-lg font-medium text-white">{viewer.profile.displayName}</p>
                <p className="mt-1 font-mono text-sm text-slate-300">@{viewer.username}</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">{viewer.email}</p>
              </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-5">
              <p className="text-sm text-slate-400">Bio</p>
              <p className="mt-2 text-sm leading-7 text-slate-300">
                {viewer.profile.bio ?? "Profile bio is not set yet."}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick routes</CardTitle>
            <CardDescription>Most-used entry points for stage 5.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Link href="/app/settings/profile">
              <Button className="w-full justify-between" variant="secondary">
                Open profile settings
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/app/settings/notifications">
              <Button className="w-full justify-between" variant="secondary">
                Open notification settings
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/app/hubs">
              <Button className="w-full justify-between" variant="secondary">
                Browse joined hubs
                <Layers3 className="h-4 w-4" />
              </Button>
            </Link>
            {isAdmin ? (
              <Link href="/app/admin">
                <Button className="w-full justify-between" variant="secondary">
                  Open admin dashboard
                  <ShieldCheck className="h-4 w-4" />
                </Button>
              </Link>
            ) : null}
            <Link href="/app/messages">
              <Button className="w-full justify-between" variant="secondary">
                Open messages
                <MessageSquare className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/app/settings/profile">
              <Button className="w-full justify-between" variant="secondary">
                Customize avatar
                <Settings2 className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
