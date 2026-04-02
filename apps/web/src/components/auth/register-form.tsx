"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { authSessionResponseSchema, registerSchema, type RegisterInput } from "@lobby/shared";
import { startTransition, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClientFetch } from "@/lib/api-client";

export function RegisterForm() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      email: "",
      displayName: "",
      password: "",
      accessKey: "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await apiClientFetch("/v1/auth/register", {
        method: "POST",
        body: JSON.stringify(values),
      });

      authSessionResponseSchema.parse(response);
      await ensureSessionCookiePersisted();

      startTransition(() => {
        router.push("/app");
        router.refresh();
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to activate account");
    } finally {
      setIsSubmitting(false);
    }
  });


  async function ensureSessionCookiePersisted() {
    try {
      const me = await apiClientFetch("/v1/auth/me");
      authSessionResponseSchema.parse(me);
    } catch {
      throw new Error(
        "Signed in, but session cookie was not persisted. Check SESSION_COOKIE_DOMAIN/SESSION_COOKIE_SECURE and HTTPS proxy setup.",
      );
    }
  }

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input id="username" placeholder="owner" autoComplete="username" {...form.register("username")} />
          <p className="text-xs text-rose-300">{form.formState.errors.username?.message}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="displayName">Display name</Label>
          <Input id="displayName" placeholder="Owner" autoComplete="name" {...form.register("displayName")} />
          <p className="text-xs text-rose-300">{form.formState.errors.displayName?.message}</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="owner@lobby.local"
          autoComplete="email"
          {...form.register("email")}
        />
        <p className="text-xs text-rose-300">{form.formState.errors.email?.message}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          placeholder="At least 12 characters"
          autoComplete="new-password"
          {...form.register("password")}
        />
        <p className="text-xs text-rose-300">{form.formState.errors.password?.message}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="accessKey">Access key</Label>
        <Input
          id="accessKey"
          placeholder="LBY-XXXXXXXX-XXXXXXXX-XXXXXXXX"
          autoComplete="off"
          {...form.register("accessKey")}
        />
        <p className="text-xs text-rose-300">{form.formState.errors.accessKey?.message}</p>
      </div>

      {errorMessage ? (
        <div className="rounded-2xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          {errorMessage}
        </div>
      ) : null}

      <Button className="w-full" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Activating..." : "Activate account"}
      </Button>
    </form>
  );
}
