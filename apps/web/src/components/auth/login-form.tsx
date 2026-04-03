"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  authSessionResponseSchema,
  loginSchema,
  type LoginInput,
} from "@lobby/shared";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClientFetch, ApiClientError } from "@/lib/api-client";

export function LoginForm() {
  const router = useRouter();
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
      router.replace("/app");
      router.refresh();
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
        "Вход выполнен, но cookie сессии не сохранилась. Проверьте SESSION_COOKIE_DOMAIN/SESSION_COOKIE_SECURE и HTTPS-прокси.",
      );
    }
  }

  function mapLoginError(error: unknown): string {
    if (error instanceof ApiClientError && error.code === "network_or_cors") {
      return "Ошибка сети/CORS при обращении к API. Проверьте API URL, CORS и настройки cookie/HTTPS.";
    }

    if (error instanceof ApiClientError && error.status === 401) {
      return error.message;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return "Не удалось войти";
  }

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <div className="space-y-2">
        <Label htmlFor="login">Логин или почта</Label>
        <Input
          id="login"
          placeholder="owner"
          autoComplete="username"
          {...form.register("login")}
        />
        <p className="text-xs text-rose-300">
          {form.formState.errors.login?.message}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Пароль</Label>
        <Input
          id="password"
          type="password"
          placeholder="Ваш пароль"
          autoComplete="current-password"
          {...form.register("password")}
        />
        <p className="text-xs text-rose-300">
          {form.formState.errors.password?.message}
        </p>
      </div>

      <div className="surface-subtle rounded-[24px] px-4 py-4 text-sm leading-7 text-[var(--text-dim)]">
        Используйте логин или рабочую почту. Сессия будет подтверждена сервером
        до перехода в закрытую рабочую область.
      </div>

      {errorMessage ? (
        <div className="rounded-[22px] border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          {errorMessage}
        </div>
      ) : null}

      <Button className="w-full" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Вход..." : "Войти"}
      </Button>
    </form>
  );
}
