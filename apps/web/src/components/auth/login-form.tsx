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
      return "Не удалось связаться с сервером. Проверьте адрес API, CORS и настройки cookie.";
    }

    if (error instanceof ApiClientError) {
      switch (error.apiCode) {
        case "AUTH_INVALID_CREDENTIALS":
          return "Неверный логин, почта или пароль.";
        case "AUTH_ACCOUNT_BLOCKED":
          return "Аккаунт заблокирован модерацией.";
        case "RATE_LIMITED":
          return "Слишком много попыток входа. Подождите минуту и повторите.";
        default:
          return error.message || "Не удалось войти в аккаунт.";
      }
    }

    if (error instanceof Error) {
      return error.message || "Не удалось войти в аккаунт.";
    }

    return "Не удалось войти в аккаунт.";
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="space-y-2">
        <Label htmlFor="login">Логин или почта</Label>
        <Input
          id="login"
          placeholder="Логин или почта"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
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
          autoCorrect="off"
          spellCheck={false}
          {...form.register("password")}
        />
        <p className="text-xs text-rose-300">
          {form.formState.errors.password?.message}
        </p>
      </div>

      <div className="surface-subtle rounded-[16px] px-3 py-2.5 text-sm text-[var(--text-dim)]">
        Войдите по логину или адресу электронной почты.
      </div>

      {errorMessage ? (
        <div className="rounded-[22px] border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          {errorMessage}
        </div>
      ) : null}

      <Button className="w-full" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Входим..." : "Войти"}
      </Button>
    </form>
  );
}
