import Link from "next/link";
import { ArrowRight, KeyRound, RadioTower, ShieldCheck, UserRound } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requireViewer } from "@/lib/server-session";

export default async function AppPage() {
  const viewer = await requireViewer();

  return (
    <section className="grid gap-6 lg:grid-cols-[0.72fr_0.28fr]">
      <Card>
        <CardHeader>
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-sky-200/70">
            Dashboard
          </p>
          <CardTitle>Lobby shell is active</CardTitle>
          <CardDescription>
            Invite-only auth, profiles, friendships, blocks and direct messages are connected.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-5">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-300/10 text-sky-300">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <p className="text-sm text-slate-400">Role</p>
            <p className="mt-1 text-lg font-medium text-white">{viewer.role}</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-5">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-300/10 text-sky-300">
              <RadioTower className="h-5 w-5" />
            </div>
            <p className="text-sm text-slate-400">Presence</p>
            <p className="mt-1 text-lg font-medium text-white">{viewer.profile.presence}</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-5">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-300/10 text-sky-300">
              <KeyRound className="h-5 w-5" />
            </div>
            <p className="text-sm text-slate-400">Login</p>
            <p className="mt-1 font-mono text-lg text-white">{viewer.username}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Current account</CardTitle>
            <CardDescription>Baseline user and profile foundation for stage 1.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-5">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-300/10 text-sky-300">
                <UserRound className="h-5 w-5" />
              </div>
              <p className="text-sm text-slate-400">Display name</p>
              <p className="mt-1 text-lg font-medium text-white">{viewer.profile.displayName}</p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-5">
              <p className="text-sm text-slate-400">Email</p>
              <p className="mt-1 text-lg font-medium text-white">{viewer.email}</p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-5">
              <p className="text-sm text-slate-400">Bio</p>
              <p className="mt-1 text-sm leading-6 text-slate-300">
                {viewer.profile.bio ?? "Profile bio is not set yet."}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Foundation scope</CardTitle>
            <CardDescription>Stage 2 adds private people discovery and one-to-one messaging.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-7 text-slate-300">
            <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-4">
              Friend requests, accepted states and block rules
            </div>
            <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-4">
              Direct conversations with unread counters and per-DM settings
            </div>
            <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-4">
              Retention cleanup through BullMQ worker sweep jobs
            </div>
            <div className="grid gap-3 pt-2 sm:grid-cols-2">
              <Link href="/app/people">
                <Button className="w-full justify-between" variant="secondary">
                  Open people
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/app/messages">
                <Button className="w-full justify-between" variant="secondary">
                  Open messages
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
