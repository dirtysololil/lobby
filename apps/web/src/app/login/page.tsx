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
      eyebrow="Member login"
      title="Welcome back"
      description="Enter your username or email and continue into your private Lobby space."
      footer={
        <>
          No account yet?{" "}
          <Link className="text-sky-300 transition hover:text-sky-200" href="/register">
            Activate with an access key
          </Link>
        </>
      }
    >
      <LoginForm />
    </AuthShell>
  );
}
