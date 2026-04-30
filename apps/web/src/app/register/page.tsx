import Link from "next/link";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/auth/register-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { fetchViewer } from "@/lib/server-session";

interface RegisterPageProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

function getSingleValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function RegisterPage({
  searchParams,
}: RegisterPageProps) {
  const viewer = await fetchViewer();
  const inviteFromUrl = getSingleValue(searchParams?.invite)?.trim() || null;

  if (viewer) {
    redirect("/app/home");
  }

  return (
    <AuthShell
      eyebrow="Регистрация"
      title="Регистрация"
      footer={
        <>
          Уже есть аккаунт?{" "}
          <Link
            className="text-[var(--accent)] transition hover:text-[var(--accent-strong)]"
            href="/login"
          >
            Войти
          </Link>
        </>
      }
    >
      <RegisterForm inviteFromUrl={inviteFromUrl} />
    </AuthShell>
  );
}
