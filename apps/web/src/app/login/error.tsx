"use client";

import Link from "next/link";

export default function LoginError({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold text-white">Вход временно недоступен</h1>
      <p className="text-sm text-slate-300">Повторите попытку или перейдите к регистрации.</p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-full bg-sky-300 px-4 py-2 text-sm font-medium text-slate-950"
        >
          Повторить
        </button>
        <Link href="/register" className="rounded-full border border-white/15 px-4 py-2 text-sm text-white">
          К регистрации
        </Link>
      </div>
    </main>
  );
}
