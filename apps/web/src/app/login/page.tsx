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
      title="С возвращением"
      description="Введите логин или почту, чтобы войти в закрытое пространство Lobby."
      footer={
        <>
          Нет аккаунта?{" "}
          <Link className="text-sky-300 transition hover:text-sky-200" href="/register">
            Активировать по ключу
          </Link>
        </>
      }
    >
      <LoginForm />
    </AuthShell>
  );
}
