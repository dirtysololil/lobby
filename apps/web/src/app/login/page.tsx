import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { fetchViewer } from "@/lib/server-session";

export default async function LoginPage() {
  const viewer = await fetchViewer();

  if (viewer) {
    redirect("/app");
  }

  return (
    <AuthShell
      eyebrow="Вход"
      title="Вход в закрытый контур"
      description="Введите логин или почту, чтобы вернуться в личные диалоги, хабы и приватные рабочие пространства Lobby."
      footer={
        <>
          Нет аккаунта?{" "}
          <Link
            className="text-[var(--accent)] transition hover:text-[var(--accent-strong)]"
            href="/register"
          >
            Активировать по ключу
          </Link>
        </>
      }
    >
      <LoginForm />
    </AuthShell>
  );
}
