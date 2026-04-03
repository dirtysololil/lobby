import Link from "next/link";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/auth/register-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { fetchViewer } from "@/lib/server-session";

export default async function RegisterPage() {
  const viewer = await fetchViewer();

  if (viewer) {
    redirect("/app");
  }

  return (
    <AuthShell
      eyebrow="Активация"
      title="Активация доступа"
      description="Создайте аккаунт по валидному ключу приглашения и войдите в приватную сеть Lobby без публичной регистрации."
      footer={
        <>
          Уже активировали аккаунт?{" "}
          <Link
            className="text-sky-300 transition hover:text-sky-200"
            href="/login"
          >
            Войти
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthShell>
  );
}
