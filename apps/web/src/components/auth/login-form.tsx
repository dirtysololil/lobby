"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { authSessionResponseSchema, loginSchema, type LoginInput } from "@lobby/shared";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClientFetch, ApiClientError } from "@/lib/api-client";

export function LoginForm() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      login: "",
      password: "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    console.info("[auth/login] submit:start");

    try {
      const response = await apiClientFetch("/v1/auth/login", {
        method: "POST",
        body: JSON.stringify(values),
      });

      authSessionResponseSchema.parse(response);
      console.info("[auth/login] submit:success");
      await ensureSessionCookiePersisted();
      window.location.assign("/app");
    } catch (error) {
      console.warn("[auth/login] submit:error");
      setErrorMessage(mapLoginError(error));
    } finally {
      setIsSubmitting(false);
    }
  });


  async function ensureSessionCookiePersisted() {
    try {
      const me = await apiClientFetch("/v1/auth/me");
      authSessionResponseSchema.parse(me);
      console.info("[auth/login] session:verified");
    } catch {
      console.warn("[auth/login] session:not-persisted");
      throw new Error(
        "Signed in, but session cookie was not persisted. Check SESSION_COOKIE_DOMAIN/SESSION_COOKIE_SECURE and HTTPS proxy setup.",
      );
    }
  }

  function mapLoginError(error: unknown): string {
    if (error instanceof ApiClientError && error.code === "network_or_cors") {
      return "Network/CORS error while contacting API. Check API URL, CORS and HTTPS/cookie settings.";
    }

    if (error instanceof ApiClientError && error.status === 401) {
      return error.message;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return "Unable to sign in";
  }

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <div className="space-y-2">
        <Label htmlFor="login">Login or email</Label>
        <Input id="login" placeholder="owner" autoComplete="username" {...form.register("login")} />
        <p className="text-xs text-rose-300">{form.formState.errors.login?.message}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          placeholder="Your password"
          autoComplete="current-password"
          {...form.register("password")}
        />
        <p className="text-xs text-rose-300">{form.formState.errors.password?.message}</p>
      </div>

      {errorMessage ? (
        <div className="rounded-2xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          {errorMessage}
        </div>
      ) : null}

      <Button className="w-full" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}
