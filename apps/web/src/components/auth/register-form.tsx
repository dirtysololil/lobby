"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  authSessionResponseSchema,
  inviteLookupResponseSchema,
  registerSchema,
  type InviteLookupResponse,
  type RegisterInput,
} from "@lobby/shared";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClientFetch, ApiClientError } from "@/lib/api-client";

interface RegisterFormProps {
  inviteFromUrl?: string | null;
}

const roleLabels = {
  OWNER: "Владелец",
  ADMIN: "Администратор",
  MEMBER: "Участник",
} as const;

export function RegisterForm({ inviteFromUrl = null }: RegisterFormProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [inviteLookup, setInviteLookup] = useState<InviteLookupResponse | null>(
    null,
  );
  const [inviteLookupError, setInviteLookupError] = useState<string | null>(
    null,
  );
  const [isManualAccessKeyEntry, setIsManualAccessKeyEntry] =
    useState(!inviteFromUrl);
  const [isResolvingInvite, setIsResolvingInvite] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      email: "",
      displayName: "",
      password: "",
      accessKey: inviteFromUrl ?? "",
    },
  });
  const accessKeyValue = form.watch("accessKey");

  useEffect(() => {
    if (!inviteFromUrl) {
      setInviteLookup(null);
      setInviteLookupError(null);
      setIsManualAccessKeyEntry(true);
      return;
    }

    setIsManualAccessKeyEntry(false);
    form.setValue("accessKey", inviteFromUrl, {
      shouldDirty: false,
      shouldValidate: false,
    });
    async function lookupInviteByKey(inviteKey: string) {
      setInviteLookup(null);
      setInviteLookupError(null);
      setIsResolvingInvite(true);

      try {
        const response = inviteLookupResponseSchema.parse(
          await apiClientFetch(
            `/v1/invites/resolve?invite=${encodeURIComponent(inviteKey)}`,
          ),
        );

        setInviteLookup(response);

        if (response.status === "ACTIVE") {
          form.clearErrors("accessKey");
          return;
        }

        form.setError("accessKey", {
          type: "manual",
          message: mapInviteStatusToMessage(response.status),
        });
      } catch (error) {
        setInviteLookupError(
          error instanceof ApiClientError && error.code === "network_or_cors"
            ? "Не удалось проверить ссылку-приглашение из-за проблем с сетью."
            : "Не удалось проверить ссылку-приглашение. Попробуйте позже или введите ключ вручную.",
        );
      } finally {
        setIsResolvingInvite(false);
      }
    }

    void lookupInviteByKey(inviteFromUrl);
  }, [form, inviteFromUrl]);

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
      return "Не удалось связаться с сервером. Проверьте адрес API, CORS и настройки cookie.";
    }

    if (error instanceof ApiClientError) {
      switch (error.apiCode) {
        case "AUTH_USERNAME_TAKEN":
          return "Этот логин уже занят.";
        case "AUTH_EMAIL_TAKEN":
          return "Эта почта уже используется.";
        case "INVITE_INVALID":
          return "Инвайт недействителен.";
        case "INVITE_REVOKED":
          return "Инвайт отключён администратором.";
        case "INVITE_EXPIRED":
          return "Срок действия инвайта истёк.";
        case "INVITE_USED":
          return "Инвайт уже использован.";
        case "INVITE_EXHAUSTED":
          return "Лимит использований инвайта исчерпан.";
        case "INVITE_CONSUME_CONFLICT":
          return "Не удалось активировать инвайт. Попробуйте ещё раз.";
        case "RATE_LIMITED":
          return "Слишком много попыток регистрации. Подождите минуту и повторите.";
        case "VALIDATION_ERROR":
          return "Проверьте заполнение формы и повторите попытку.";
        default:
          return error.message || "Не удалось зарегистрировать аккаунт.";
      }
    }

    if (error instanceof Error) {
      return error.message || "Не удалось зарегистрировать аккаунт.";
    }

    return "Не удалось зарегистрировать аккаунт.";
  }

  function mapInviteStatusToMessage(status: InviteLookupResponse["status"]) {
    switch (status) {
      case "REVOKED":
        return "Инвайт отключён администратором.";
      case "EXPIRED":
        return "Срок действия инвайта истёк.";
      case "USED":
        return "Инвайт уже использован.";
      case "EXHAUSTED":
        return "Лимит использований инвайта исчерпан.";
      default:
        return "Инвайт недействителен.";
    }
  }

  const isInviteLinkMode = Boolean(inviteFromUrl && !isManualAccessKeyEntry);
  const isInviteReady = inviteLookup?.status === "ACTIVE" && !inviteLookupError;
  const isSubmitBlocked =
    isSubmitting || (isInviteLinkMode && (!isInviteReady || isResolvingInvite));

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="username">Имя пользователя</Label>
          <Input
            id="username"
            placeholder="Имя пользователя"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            {...form.register("username")}
          />
          <p className="text-xs text-[var(--text-muted)]">
            Допустимы строчные латинские буквы, цифры, символы `_` и `-`.
          </p>
          <p className="text-xs text-rose-300">
            {form.formState.errors.username?.message}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="displayName">Отображаемое имя</Label>
          <Input
            id="displayName"
            placeholder="Отображаемое имя"
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
          placeholder="Почта"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
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
          placeholder="Минимум 8 символов"
          autoComplete="new-password"
          autoCorrect="off"
          spellCheck={false}
          {...form.register("password")}
        />
        <p className="text-xs text-rose-300">
          {form.formState.errors.password?.message}
        </p>
      </div>

      <div className="surface-subtle rounded-[16px] px-3 py-2.5 text-sm text-[var(--text-dim)]">
        Доступ к регистрации открыт только по валидному инвайту.
      </div>

      {isInviteLinkMode ? (
        <div className="space-y-2 rounded-[18px] border border-[var(--border)] bg-white/[0.03] p-4">
          <input type="hidden" {...form.register("accessKey")} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label htmlFor="invite-link-access-key">Ссылка-приглашение</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsManualAccessKeyEntry(true);
                setInviteLookupError(null);
                setErrorMessage(null);
                form.setValue("accessKey", inviteFromUrl ?? "", {
                  shouldDirty: true,
                  shouldValidate: true,
                });
              }}
            >
              Ввести другой ключ
            </Button>
          </div>

          <Input
            id="invite-link-access-key"
            value={accessKeyValue}
            readOnly
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />

          <p className="text-xs text-[var(--text-dim)]">
            {isResolvingInvite
              ? "Проверяем ссылку-приглашение..."
              : inviteLookupError
                ? inviteLookupError
                : inviteLookup?.status === "ACTIVE"
                  ? `Ссылка активна. Роль после регистрации: ${
                      inviteLookup.invite
                        ? roleLabels[inviteLookup.invite.role]
                        : "Участник"
                    }${
                      inviteLookup.invite
                        ? `, осталось активаций: ${inviteLookup.invite.remainingUses}.`
                        : "."
                    }`
                  : mapInviteStatusToMessage(inviteLookup?.status ?? "INVALID")}
          </p>

          {inviteLookup?.status !== "ACTIVE" || inviteLookupError ? (
            <p className="text-xs text-rose-300">
              {form.formState.errors.accessKey?.message}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="accessKey">Ключ доступа</Label>
          <Input
            id="accessKey"
            placeholder="LBY-XXXXXXXX-XXXXXXXX-XXXXXXXX"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            {...form.register("accessKey")}
          />
          <p className="text-xs text-rose-300">
            {form.formState.errors.accessKey?.message}
          </p>
        </div>
      )}

      {errorMessage ? (
        <div className="rounded-[22px] border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          {errorMessage}
        </div>
      ) : null}

      <Button className="w-full" type="submit" disabled={isSubmitBlocked}>
        {isSubmitting ? "Регистрируем..." : "Создать аккаунт"}
      </Button>
    </form>
  );
}
