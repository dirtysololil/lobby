import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { CookieConsentBanner } from "@/components/privacy/cookie-consent-banner";
import { fetchViewer } from "@/lib/server-session";

export default async function Home() {
  const viewer = await fetchViewer();

  if (viewer) {
    redirect("/app/home");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[760px] flex-col justify-center px-3 py-10 lg:px-4">
      <section className="shell-frame mx-auto flex w-full max-w-[620px] flex-col rounded-[24px] p-4 lg:p-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="dock-icon flex h-11 w-11 items-center justify-center rounded-[14px] border border-white/10 bg-white text-black">
              <span className="text-sm font-bold tracking-[-0.04em]">Lb</span>
            </div>
            <div>
              <p className="section-kicker">Lobby</p>
              <p className="text-sm text-[var(--text-dim)]">
                Закрытая коммуникационная платформа
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="eyebrow-pill">
              <ShieldCheck className="h-3.5 w-3.5" />
              Закрытая сеть
            </span>
          </div>

          <h1 className="mt-4 max-w-xl font-[var(--font-heading)] text-3xl font-semibold tracking-[-0.06em] text-white sm:text-[2.6rem]">
            Приватное общение для команд с доступом по приглашению.
          </h1>

        </div>

        <div className="mt-6 flex flex-wrap gap-2.5">
          <Link
            href="/register"
            className="inline-flex min-h-[38px] items-center gap-2 rounded-[12px] border border-[#0070F3] bg-[#0070F3] px-4 text-sm font-semibold text-white transition-colors hover:border-[#0064d8] hover:bg-[#0064d8]"
          >
            Активировать доступ <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/login"
            className="inline-flex min-h-[38px] items-center gap-2 rounded-[12px] border border-[var(--border)] bg-black px-4 text-sm font-medium text-[var(--text)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)]"
          >
            Войти
          </Link>
          <Link
            href="/privacy"
            className="inline-flex min-h-[38px] items-center gap-2 rounded-[12px] border border-transparent px-4 text-sm font-medium text-[var(--text-dim)] transition-colors hover:text-white"
          >
            Политика конфиденциальности
          </Link>
        </div>
      </section>
      <CookieConsentBanner />
    </main>
  );
}
