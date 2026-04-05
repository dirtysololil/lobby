"use client";

import { KeyRound, ShieldCheck, Sparkles } from "lucide-react";
import {
  createInviteSchema,
  inviteCreateResponseSchema,
  type InviteSummary,
} from "@lobby/shared";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/select-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/empty-state";
import { apiClientFetch } from "@/lib/api-client";

interface InviteAdminPanelProps {
  invites: InviteSummary[];
}

type InviteFormValues = {
  label: string;
  role: "MEMBER" | "ADMIN" | "OWNER";
  maxUses: number;
  expiresAt: string;
};

const iconProps = { size: 18, strokeWidth: 1.5 } as const;
const roleOptions: InviteFormValues["role"][] = ["MEMBER", "ADMIN", "OWNER"];
const roleLabels: Record<InviteFormValues["role"], string> = {
  MEMBER: "Участник",
  ADMIN: "Администратор",
  OWNER: "Владелец",
};

export function InviteAdminPanel({ invites }: InviteAdminPanelProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [latestRawCode, setLatestRawCode] = useState<string | null>(null);
  const form = useForm<InviteFormValues>({
    defaultValues: { label: "", role: "MEMBER", maxUses: 1, expiresAt: "" },
  });

  async function createInvite(values: InviteFormValues) {
    setError(null);
    setMessage(null);
    setLatestRawCode(null);

    try {
      const payload = createInviteSchema.parse({
        label: values.label || null,
        role: values.role,
        maxUses: values.maxUses,
        expiresAt: values.expiresAt
          ? new Date(values.expiresAt).toISOString()
          : null,
      });
      const response = inviteCreateResponseSchema.parse(
        await apiClientFetch("/v1/invites", {
          method: "POST",
          body: JSON.stringify(payload),
        }),
      );

      setLatestRawCode(response.rawCode);
      setMessage("Инвайт создан.");
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
        className="premium-panel rounded-[24px] p-5"
        onSubmit={form.handleSubmit((values) => void createInvite(values))}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow-pill">
            <KeyRound {...iconProps} />
            Новый инвайт
          </span>
          <span className="status-pill">
            <ShieldCheck {...iconProps} />
            Контролируемый доступ
          </span>
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
              Оставьте пустым, чтобы ключ работал до отзыва или полного расходования.
            </p>
          </div>

          <div className="surface-subtle rounded-[18px] px-4 py-3 text-sm text-[var(--text-dim)]">
            Один ключ сразу задает роль, срок жизни и окно использования для онбординга.
          </div>
        </div>

        {latestRawCode ? (
          <div className="mt-5 rounded-[18px] border border-emerald-300/15 bg-emerald-300/[0.06] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-emerald-100/75">
              Исходный код инвайта
            </p>
            <p className="mt-2 break-all font-mono text-sm text-white">
              {latestRawCode}
            </p>
          </div>
        ) : null}

        {error ? <p className="mt-4 text-sm text-rose-200">{error}</p> : null}
        {message ? <p className="mt-4 text-sm text-emerald-200">{message}</p> : null}

        <div className="mt-5 flex gap-2">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Создаем..." : "Создать инвайт"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => router.refresh()}>
            Обновить
          </Button>
        </div>
      </form>

      <section className="premium-panel rounded-[24px] p-0">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
          <div>
            <p className="text-sm font-medium text-white">Последние инвайты</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Держите онбординг под контролем и без лишнего шума.
            </p>
          </div>
          <span className="status-pill">
            <Sparkles {...iconProps} />
            {invites.length} активных
          </span>
        </div>

        <div className="min-h-0 overflow-y-auto">
          {invites.length === 0 ? (
            <EmptyState
              className="py-10"
              title="Инвайтов пока нет"
              description="Создайте первый инвайт, когда будете готовы подключать новую группу."
            />
          ) : (
            invites.map((invite) => (
              <div
                key={invite.id}
                className="flex flex-col gap-3 border-b border-[var(--border-soft)] px-4 py-3 transition-colors hover:bg-[var(--bg-hover)] lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium text-white">
                      {invite.label ?? "Инвайт без названия"}
                    </p>
                    <span className="glass-badge">{roleLabels[invite.role]}</span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--text-dim)]">
                    Использований {invite.usedCount}/{invite.maxUses}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {invite.revokedAt
                      ? `Отозван ${new Date(invite.revokedAt).toLocaleString("ru-RU")}`
                      : invite.expiresAt
                        ? `Истекает ${new Date(invite.expiresAt).toLocaleString("ru-RU")}`
                        : "Без срока действия"}
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => void revokeInvite(invite.id)}
                    disabled={Boolean(invite.revokedAt)}
                  >
                    {invite.revokedAt ? "Отозван" : "Отозвать"}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
