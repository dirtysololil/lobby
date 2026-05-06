"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const COOKIE_NOTICE_KEY = "lobby:cookie-notice-accepted";

export function CookieConsentBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setIsVisible(window.localStorage.getItem(COOKIE_NOTICE_KEY) !== "true");
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  function acceptNotice() {
    window.localStorage.setItem(COOKIE_NOTICE_KEY, "true");
    setIsVisible(false);
  }

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-[720px] rounded-[16px] border border-[var(--border-strong)] bg-[#050505] p-3 shadow-[var(--shadow-md)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-5 text-[var(--text-dim)]">
          Мы используем технические cookies для входа, безопасности и стабильной
          работы сервиса. Продолжая пользоваться Lobby, вы соглашаетесь с{" "}
          <Link href="/privacy" className="text-white underline-offset-4 hover:underline">
            политикой конфиденциальности
          </Link>
          .
        </p>
        <button
          type="button"
          onClick={acceptNotice}
          className="inline-flex min-h-[36px] shrink-0 items-center justify-center rounded-[12px] border border-white bg-white px-4 text-sm font-semibold text-black transition-colors hover:bg-[#f1f1f1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          Понятно
        </button>
      </div>
    </div>
  );
}
