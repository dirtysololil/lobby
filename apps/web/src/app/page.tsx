import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, KeyRound, Lock, ShieldCheck } from "lucide-react";
import { fetchViewer } from "@/lib/server-session";

export default async function Home() {
  const viewer = await fetchViewer();

  if (viewer) {
    redirect("/app");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8 sm:px-10 lg:px-12">
      <div className="mb-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 shadow-[0_0_40px_rgba(56,189,248,0.18)]">
            <ShieldCheck className="h-5 w-5 text-sky-300" />
          </div>
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.32em] text-sky-200/70">Lobby</p>
            <p className="text-sm text-slate-300">Private communication platform</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:border-sky-300/30 hover:bg-white/8"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="rounded-full bg-sky-300 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-sky-200"
          >
            Activate access
          </Link>
        </div>
      </div>

      <section className="grid flex-1 gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
        <div className="space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-300/20 bg-sky-300/10 px-4 py-2 font-mono text-xs uppercase tracking-[0.24em] text-sky-100/90">
            Invite-only foundation is live
          </div>

          <div className="space-y-5">
            <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-white sm:text-6xl">
              Secure entry point for a private Lobby.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-slate-300">
              Access is opened only by signed invite keys, sessions live in HttpOnly cookies, and the
              first production foundation is ready for the next domain modules.
            </p>
          </div>

          <div className="flex flex-wrap gap-4">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-full bg-sky-300 px-5 py-3 font-medium text-slate-950 transition hover:bg-sky-200"
            >
              Register with access key
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-3 font-medium text-slate-100 transition hover:border-sky-300/30 hover:bg-white/8"
            >
              Sign in
            </Link>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[var(--panel)] p-6 shadow-[var(--shadow)] backdrop-blur-xl">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(125,211,252,0.18),transparent_45%)]" />
          <div className="relative space-y-4">
            <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-5">
              <p className="font-mono text-xs uppercase tracking-[0.24em] text-sky-200/70">Stage 01</p>
              <p className="mt-3 text-xl font-medium text-white">Monorepo, Prisma, auth, invite gate</p>
            </div>

            <div className="grid gap-3">
              {[
                {
                  icon: KeyRound,
                  title: "Invite-only registration",
                  text: "No public sign-up path. Access key is required and stored hashed.",
                },
                {
                  icon: Lock,
                  title: "Cookie session auth",
                  text: "HttpOnly cookie session with secure hashing and reverse-proxy safe config.",
                },
                {
                  icon: ShieldCheck,
                  title: "Audit-ready backend",
                  text: "Critical auth actions already write to audit log storage.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-sky-300/20 hover:bg-white/[0.05]"
                >
                  <item.icon className="mb-3 h-5 w-5 text-sky-300" />
                  <p className="text-base font-medium text-white">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
