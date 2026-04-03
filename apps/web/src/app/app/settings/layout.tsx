import type { ReactNode } from "react";
import { SettingsNav } from "@/components/settings/settings-nav";

export default function SettingsLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <div className="grid gap-6">
      <section className="premium-panel rounded-[32px] p-6 lg:p-8">
        <p className="section-kicker">Личные настройки</p>
        <h1 className="mt-4 font-[var(--font-heading)] text-3xl font-semibold tracking-[-0.04em] text-white">
          Профиль и уведомления
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--text-dim)]">
          Здесь находится персональный слой продукта: публичная карточка внутри
          сети, аватар, присутствие и правила сигналов для личных диалогов,
          хабов и лобби.
        </p>
        <div className="surface-subtle mt-5 rounded-[24px] p-4 text-sm leading-7 text-[var(--text-dim)]">
          Настройки в Lobby не выглядят как вторичная служебная форма. Это часть
          общей premium-системы, в которой идентичность пользователя и
          шум-контроль одинаково важны.
        </div>
      </section>
      <SettingsNav />
      {children}
    </div>
  );
}
