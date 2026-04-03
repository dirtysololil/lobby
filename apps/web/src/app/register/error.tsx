"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function RegisterError({ reset }: { reset: () => void }) {
  useEffect(() => {
    // no-op: keeps boundary client-only and stable for auth pages
  }, []);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold text-white">Регистрация временно недоступна</h1>
      <p className="text-sm text-slate-300">Повторите попытку или войдите в существующий аккаунт.</p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-full bg-sky-300 px-4 py-2 text-sm font-medium text-slate-950"
        >
          Повторить
        </button>
        <Link href="/login" className="rounded-full border border-white/15 px-4 py-2 text-sm text-white">
          Ко входу
        </Link>
      </div>
    </main>
  );
}
