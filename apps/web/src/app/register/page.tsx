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
      eyebrow="Invite activation"
      title="Create your account"
      description="Access remains closed without a valid key. Enter your invite, then your session will be issued immediately."
      footer={
        <>
          Already activated?{" "}
          <Link className="text-sky-300 transition hover:text-sky-200" href="/login">
            Sign in
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthShell>
  );
}
