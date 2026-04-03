"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  authSessionResponseSchema,
  registerSchema,
  type RegisterInput,
} from "@lobby/shared";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClientFetch, ApiClientError } from "@/lib/api-client";

export function RegisterForm() {
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
    console.info("[auth/register] submit:start");

    try {
      const response = await apiClientFetch("/v1/auth/register", {
        method: "POST",
        body: JSON.stringify(values),
      });

      authSessionResponseSchema.parse(response);
      console.info("[auth/register] submit:success");
      await ensureSessionCookiePersisted();
      window.location.assign("/app");
    } catch (error) {
      console.warn("[auth/register] submit:error");
      setErrorMessage(mapRegisterError(error));
    } finally {
      setIsSubmitting(false);
    }
  });

  async function ensureSessionCookiePersisted() {
    try {
      const me = await apiClientFetch("/v1/auth/me");
      authSessionResponseSchema.parse(me);
      console.info("[auth/register] session:verified");
    } catch {
      console.warn("[auth/register] session:not-persisted");
      throw new Error(
        "Вход выполнен, но cookie сессии не сохранилась. Проверьте SESSION_COOKIE_DOMAIN/SESSION_COOKIE_SECURE и HTTPS-прокси.",
      );
    }
  }

  function mapRegisterError(error: unknown): string {
    if (error instanceof ApiClientError && error.code === "network_or_cors") {
      return "Ошибка сети/CORS при обращении к API. Проверьте API URL, CORS и настройки cookie/HTTPS.";
    }

    if (error instanceof Error) {
      return error.message;
    }

    return "Не удалось активировать аккаунт";
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="username">Имя пользователя</Label>
          <Input
            id="username"
            placeholder="owner"
            autoComplete="username"
            {...form.register("username")}
          />
          <p className="text-xs text-rose-300">
            {form.formState.errors.username?.message}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="displayName">Отображаемое имя</Label>
          <Input
            id="displayName"
            placeholder="Owner"
            autoComplete="name"
            {...form.register("displayName")}
          />
          <p className="text-xs text-rose-300">
            {form.formState.errors.displayName?.message}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Почта</Label>
        <Input
          id="email"
          type="email"
          placeholder="owner@lobby.local"
          autoComplete="email"
          {...form.register("email")}
        />
        <p className="text-xs text-rose-300">
          {form.formState.errors.email?.message}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Пароль</Label>
        <Input
          id="password"
          type="password"
          placeholder="Минимум 12 символов"
          autoComplete="new-password"
          {...form.register("password")}
        />
        <p className="text-xs text-rose-300">
          {form.formState.errors.password?.message}
        </p>
      </div>

      <div className="surface-subtle rounded-[16px] px-3 py-2.5 text-sm text-[var(--text-dim)]">
        Ключ доступа определяет роль и маршрут входа.
      </div>

      <div className="space-y-2">
        <Label htmlFor="accessKey">Ключ доступа</Label>
        <Input
          id="accessKey"
          placeholder="LBY-XXXXXXXX-XXXXXXXX-XXXXXXXX"
          autoComplete="off"
          {...form.register("accessKey")}
        />
        <p className="text-xs text-rose-300">
          {form.formState.errors.accessKey?.message}
        </p>
      </div>

      {errorMessage ? (
        <div className="rounded-[22px] border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          {errorMessage}
        </div>
      ) : null}

      <Button className="w-full" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Активация..." : "Активировать аккаунт"}
      </Button>
    </form>
  );
}
