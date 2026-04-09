"use client";

import { KeyRound, ShieldCheck, Sparkles } from "lucide-react";
import {
  createInviteSchema,
  inviteCreateResponseSchema,
  type InviteSummary,
} from "@lobby/shared";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/select-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/empty-state";
import { apiClientFetch } from "@/lib/api-client";
import { runtimeConfig } from "@/lib/runtime-config";

interface InviteAdminPanelProps {
  invites: InviteSummary[];
}

type InviteCreateMode = "CODE" | "LINK";
type InviteState = "ACTIVE" | "REVOKED" | "EXPIRED" | "EXHAUSTED";

type InviteFormValues = {
  label: string;
  role: "MEMBER" | "ADMIN" | "OWNER";
  maxUses: number;
  expiresAt: string;
};

type LatestInviteResult = {
  invite: InviteSummary;
  rawCode: string;
  registerUrl: string;
  mode: InviteCreateMode;
};

const iconProps = { size: 18, strokeWidth: 1.5 } as const;
const keyIconProps = { size: 16, strokeWidth: 1.5 } as const;
const roleOptions: InviteFormValues["role"][] = ["MEMBER", "ADMIN", "OWNER"];
const roleLabels: Record<InviteFormValues["role"], string> = {
  MEMBER: "Участник",
  ADMIN: "Администратор",
  OWNER: "Владелец",
};
const inviteStateMeta: Record<
  InviteState,
  {
    label: string;
    badgeClassName: string;
    progressClassName: string;
  }
> = {
  ACTIVE: {
    label: "Активен",
    badgeClassName:
      "border-emerald-300/15 bg-emerald-300/[0.08] text-emerald-100",
    progressClassName: "from-sky-400 via-cyan-300 to-emerald-300",
  },
  REVOKED: {
    label: "Отозван",
    badgeClassName: "border-white/8 bg-white/[0.05] text-[var(--text-muted)]",
    progressClassName: "from-white/25 to-white/10",
  },
  EXPIRED: {
    label: "Истек",
    badgeClassName: "border-amber-300/15 bg-amber-300/[0.08] text-amber-100",
    progressClassName: "from-amber-400 to-amber-200",
  },
  EXHAUSTED: {
    label: "Исчерпан",
    badgeClassName: "border-indigo-300/15 bg-indigo-300/[0.08] text-indigo-100",
    progressClassName: "from-indigo-400 via-sky-400 to-sky-300",
  },
};

function getInviteState(invite: InviteSummary): InviteState {
  if (invite.revokedAt) {
    return "REVOKED";
  }

  if (invite.usedCount >= invite.maxUses) {
    return "EXHAUSTED";
  }

  if (invite.expiresAt && new Date(invite.expiresAt).getTime() <= Date.now()) {
    return "EXPIRED";
  }

  return "ACTIVE";
}

function getInviteUsagePercent(invite: InviteSummary) {
  return Math.min(100, Math.round((invite.usedCount / invite.maxUses) * 100));
}

function formatInvitePreviewExpiry(expiresAt: string) {
  if (!expiresAt) {
    return "Без срока";
  }

  const parsedDate = new Date(expiresAt);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Проверьте дату";
  }

  return parsedDate.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function InviteAdminPanel({ invites }: InviteAdminPanelProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<"code" | "link" | null>(null);
  const [latestInviteResult, setLatestInviteResult] =
    useState<LatestInviteResult | null>(null);
  const form = useForm<InviteFormValues>({
    defaultValues: { label: "", role: "MEMBER", maxUses: 1, expiresAt: "" },
  });
  const previewRole =
    useWatch({ control: form.control, name: "role" }) ?? "MEMBER";
  const previewMaxUsesValue = useWatch({
    control: form.control,
    name: "maxUses",
  });
  const previewExpiresAt =
    useWatch({ control: form.control, name: "expiresAt" }) ?? "";
  const previewMaxUses =
    typeof previewMaxUsesValue === "number" &&
    Number.isFinite(previewMaxUsesValue) &&
    previewMaxUsesValue > 0
      ? previewMaxUsesValue
      : 1;
  const inviteMetrics = invites.reduce(
    (summary, invite) => {
      const state = getInviteState(invite);

      summary[state] += 1;
      return summary;
    },
    { ACTIVE: 0, REVOKED: 0, EXPIRED: 0, EXHAUSTED: 0 },
  );
  const closedInvitesCount = inviteMetrics.EXPIRED + inviteMetrics.EXHAUSTED;

  function buildRegisterUrl(rawCode: string) {
    const baseUrl =
      runtimeConfig.webPublicUrl ||
      (typeof window !== "undefined" ? window.location.origin : "");
    const path = `/register?invite=${encodeURIComponent(rawCode)}`;

    return baseUrl ? `${baseUrl}${path}` : path;
  }

  async function copyToClipboard(value: string, field: "code" | "link") {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => {
        setCopiedField((current) => (current === field ? null : current));
      }, 1600);
    } catch {
      setError("Не удалось скопировать в буфер обмена.");
    }
  }

  function formatInviteTimeline(invite: InviteSummary) {
    if (invite.revokedAt) {
      return `Отозван ${new Date(invite.revokedAt).toLocaleString("ru-RU")}`;
    }

    if (invite.expiresAt) {
      return `Истекает ${new Date(invite.expiresAt).toLocaleString("ru-RU")}`;
    }

    return "Без срока действия";
  }

  async function createInvite(
    values: InviteFormValues,
    mode: InviteCreateMode,
  ) {
    setError(null);
    setMessage(null);
    setCopiedField(null);
    setLatestInviteResult(null);

    try {
      const payload = createInviteSchema.parse({
        label: values.label || null,
        role: values.role,
        maxUses: values.maxUses,
        expiresAt: values.expiresAt
          ? new Date(values.expiresAt).toISOString()
          : null,
        mode,
      });
      const response = inviteCreateResponseSchema.parse(
        await apiClientFetch("/v1/invites", {
          method: "POST",
          body: JSON.stringify(payload),
        }),
      );

      setLatestInviteResult({
        invite: response.invite,
        rawCode: response.rawCode,
        registerUrl: buildRegisterUrl(response.rawCode),
        mode: response.mode,
      });
      setMessage(
        response.mode === "LINK"
          ? "Ссылка-приглашение создана."
          : "Инвайт создан.",
      );
      form.reset({ label: "", role: values.role, maxUses: 1, expiresAt: "" });
      router.refresh();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Не удалось создать инвайт.",
      );
    }
  }

  async function revokeInvite(inviteId: string) {
    setError(null);
    setMessage(null);

    try {
      await apiClientFetch(`/v1/invites/${inviteId}/revoke`, {
        method: "POST",
      });
      setMessage("Инвайт отозван.");
      router.refresh();
    } catch (revokeError) {
      setError(
        revokeError instanceof Error
          ? revokeError.message
          : "Не удалось отозвать этот инвайт.",
      );
    }
  }

  return (
    <div className="grid gap-4 2xl:grid-cols-[380px_minmax(0,1fr)]">
      <form
        className="premium-panel relative overflow-hidden rounded-[24px] p-5"
        onSubmit={form.handleSubmit((values, event) => {
          const nativeEvent = event?.nativeEvent;
          const submitter =
            nativeEvent &&
            typeof nativeEvent === "object" &&
            "submitter" in nativeEvent
              ? (nativeEvent.submitter as HTMLButtonElement | null)
              : null;
          const mode = submitter?.value === "LINK" ? "LINK" : "CODE";
          void createInvite(values, mode);
        })}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top_left,rgba(106,168,248,0.16),transparent_58%),radial-gradient(circle_at_top_right,rgba(52,211,153,0.08),transparent_38%)]"
        />

        <div className="relative">
          <div className="flex flex-wrap items-center gap-2">
            <span className="eyebrow-pill">
              <KeyRound {...keyIconProps} />
              Новый инвайт
            </span>
            <span className="status-pill">
              <ShieldCheck {...iconProps} />
              Контролируемый доступ
            </span>
          </div>

          <div className="mt-4">
            <p className="section-kicker">Доступ по приглашениям</p>
            <h1 className="panel-title mt-3">Гибкая выдача доступа</h1>
            <p className="panel-description mt-2 max-w-sm">
              Соберите ссылку или код под нужный сценарий доступа и сразу
              проверьте параметры перед отправкой.
            </p>
          </div>

          <div className="mt-5 grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="label">Метка</Label>
              <Input
                id="label"
                placeholder="Партнерская волна запуска"
                {...form.register("label")}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="role">Роль</Label>
                <SelectField id="role" {...form.register("role")}>
                  {roleOptions.map((option) => (
                    <option key={option} value={option}>
                      {roleLabels[option]}
                    </option>
                  ))}
                </SelectField>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="maxUses">Лимит использований</Label>
                <Input
                  id="maxUses"
                  type="number"
                  min={1}
                  max={10000}
                  {...form.register("maxUses", { valueAsNumber: true })}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="expiresAt">Истекает</Label>
              <Input
                id="expiresAt"
                type="datetime-local"
                {...form.register("expiresAt")}
              />
              <p className="text-xs text-[var(--text-muted)]">
                Оставьте пустым, чтобы ключ работал до отзыва или полного
                расходования.
              </p>
            </div>

            <div className="grid gap-3 rounded-[20px] border border-white/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="section-kicker">Профиль инвайта</p>
                  <p className="mt-1 text-sm font-medium text-white">
                    Предпросмотр настроек доступа
                  </p>
                </div>
                <span className="glass-badge">
                  {previewMaxUses === 1 ? "Точечный доступ" : "Группа доступа"}
                </span>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <div className="metric-tile rounded-[16px] px-3 py-3">
                  <p className="section-kicker">Роль</p>
                  <p className="mt-2 text-sm font-medium text-white">
                    {roleLabels[previewRole]}
                  </p>
                </div>

                <div className="metric-tile rounded-[16px] px-3 py-3">
                  <p className="section-kicker">Лимит</p>
                  <p className="mt-2 text-sm font-medium text-white">
                    {previewMaxUses}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-dim)]">
                    {previewMaxUses === 1
                      ? "Одно использование"
                      : "Использований до отзыва"}
                  </p>
                </div>

                <div className="metric-tile rounded-[16px] px-3 py-3">
                  <p className="section-kicker">Срок</p>
                  <p className="mt-2 text-sm font-medium text-white">
                    {formatInvitePreviewExpiry(previewExpiresAt)}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-dim)]">
                    {previewExpiresAt
                      ? "Дата зафиксирована"
                      : "Будет активен без дедлайна"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {latestInviteResult ? (
            <div className="mt-5 rounded-[20px] border border-emerald-300/15 bg-[linear-gradient(180deg,rgba(110,231,183,0.1),rgba(16,185,129,0.05))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-emerald-100/75">
                    {latestInviteResult.mode === "LINK"
                      ? "Ссылка-приглашение готова"
                      : "Инвайт готов"}
                  </p>
                  <p className="mt-2 text-sm text-emerald-50/85">
                    Можно сразу отправлять человеку или вставлять в сценарий
                    онбординга.
                  </p>
                </div>
                <span className="inline-flex items-center rounded-full border border-emerald-200/15 bg-emerald-200/10 px-2.5 py-1 text-[11px] font-medium text-emerald-50">
                  Готово к отправке
                </span>
              </div>

              <div className="mt-4 space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="latest-register-url">
                    Прямая ссылка регистрации
                  </Label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      id="latest-register-url"
                      readOnly
                      className="font-mono text-xs sm:text-sm"
                      value={latestInviteResult.registerUrl}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      className="shrink-0 sm:min-w-[170px]"
                      onClick={() =>
                        void copyToClipboard(
                          latestInviteResult.registerUrl,
                          "link",
                        )
                      }
                    >
                      {copiedField === "link"
                        ? "Скопировано"
                        : "Копировать ссылку"}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="latest-raw-code">Код приглашения</Label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      id="latest-raw-code"
                      readOnly
                      className="font-mono text-xs sm:text-sm"
                      value={latestInviteResult.rawCode}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      className="shrink-0 sm:min-w-[170px]"
                      onClick={() =>
                        void copyToClipboard(latestInviteResult.rawCode, "code")
                      }
                    >
                      {copiedField === "code"
                        ? "Скопировано"
                        : "Копировать код"}
                    </Button>
                  </div>
                </div>

                <div className="grid gap-2 text-xs text-emerald-100/85 sm:grid-cols-2">
                  <p>
                    Статус: активна, использований{" "}
                    {latestInviteResult.invite.usedCount}/
                    {latestInviteResult.invite.maxUses}
                  </p>
                  <p>{formatInviteTimeline(latestInviteResult.invite)}</p>
                </div>
              </div>
            </div>
          ) : null}

          {error ? <p className="mt-4 text-sm text-rose-200">{error}</p> : null}
          {message ? (
            <p className="mt-4 text-sm text-emerald-200">{message}</p>
          ) : null}

          <div className="mt-5 flex flex-col gap-2">
            <Button
              type="submit"
              value="LINK"
              className="w-full justify-center"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting
                ? "Создаем..."
                : "Создать ссылку-приглашение"}
            </Button>

            <div className="flex flex-wrap gap-2">
              <Button
                type="submit"
                value="CODE"
                variant="secondary"
                className="min-w-[200px] flex-1 justify-center"
                disabled={form.formState.isSubmitting}
              >
                Создать обычный инвайт
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="shrink-0"
                onClick={() => router.refresh()}
              >
                Обновить
              </Button>
            </div>
          </div>
        </div>
      </form>

      <section className="premium-panel relative overflow-hidden rounded-[24px] p-0">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top_left,rgba(106,168,248,0.1),transparent_34%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.04),transparent_26%)]"
        />

        <div className="relative">
          <div className="border-b border-[var(--border)] px-4 py-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <p className="text-sm font-medium text-white">Журнал инвайтов</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Сразу видно, какие ключи активны, закрыты или уже остановлены.
                </p>
              </div>
              <span className="status-pill">
                <Sparkles {...iconProps} />
                {inviteMetrics.ACTIVE} активных
              </span>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <div className="metric-tile rounded-[16px] px-3 py-3">
                <p className="section-kicker">Активные</p>
                <p className="mt-2 text-lg font-semibold tracking-tight text-white">
                  {inviteMetrics.ACTIVE}
                </p>
                <p className="mt-1 text-xs text-[var(--text-dim)]">
                  Готовы к выдаче
                </p>
              </div>

              <div className="metric-tile rounded-[16px] px-3 py-3">
                <p className="section-kicker">Завершенные</p>
                <p className="mt-2 text-lg font-semibold tracking-tight text-white">
                  {closedInvitesCount}
                </p>
                <p className="mt-1 text-xs text-[var(--text-dim)]">
                  Истекли или исчерпали лимит
                </p>
              </div>

              <div className="metric-tile rounded-[16px] px-3 py-3">
                <p className="section-kicker">Отозванные</p>
                <p className="mt-2 text-lg font-semibold tracking-tight text-white">
                  {inviteMetrics.REVOKED}
                </p>
                <p className="mt-1 text-xs text-[var(--text-dim)]">
                  Остановлены вручную
                </p>
              </div>
            </div>
          </div>

          <div className="min-h-0 overflow-y-auto">
            {invites.length === 0 ? (
              <EmptyState
                className="py-10"
                title="Инвайтов пока нет"
                description="Создайте первый инвайт, когда будете готовы подключать новую группу."
              />
            ) : (
              <div className="space-y-2 p-2.5">
                {invites.map((invite) => {
                  const inviteState = getInviteState(invite);
                  const stateMeta = inviteStateMeta[inviteState];
                  const usagePercent = getInviteUsagePercent(invite);

                  return (
                    <article
                      key={invite.id}
                      className="rounded-[20px] border border-transparent bg-white/[0.02] px-4 py-4 transition-[background,border-color] duration-150 hover:border-[var(--border)] hover:bg-[var(--bg-hover)]"
                    >
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-medium text-white">
                              {invite.label ?? "Инвайт без названия"}
                            </p>
                            <span className="glass-badge">
                              {roleLabels[invite.role]}
                            </span>
                            <span
                              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${stateMeta.badgeClassName}`}
                            >
                              {stateMeta.label}
                            </span>
                          </div>

                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                            <p className="text-[var(--text-dim)]">
                              Использований {invite.usedCount}/{invite.maxUses}
                            </p>
                            <p className="text-[var(--text-muted)]">
                              {formatInviteTimeline(invite)}
                            </p>
                            <p className="text-[var(--text-muted)]">
                              Создан{" "}
                              {new Date(invite.createdAt).toLocaleDateString(
                                "ru-RU",
                              )}
                            </p>
                          </div>

                          <div className="mt-3 max-w-xl">
                            <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                              <span>Прогресс доступа</span>
                              <span>{usagePercent}%</span>
                            </div>
                            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/5">
                              <div
                                className={`h-full rounded-full bg-gradient-to-r ${stateMeta.progressClassName}`}
                                style={{ width: `${usagePercent}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2 self-start xl:self-center">
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-9 px-4"
                            onClick={() => void revokeInvite(invite.id)}
                            disabled={Boolean(invite.revokedAt)}
                          >
                            {invite.revokedAt ? "Отозван" : "Отозвать"}
                          </Button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
