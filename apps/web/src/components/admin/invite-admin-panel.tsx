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
      setMessage("Ключ приглашения создан.");
      form.reset({ label: "", role: values.role, maxUses: 1, expiresAt: "" });
      router.refresh();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Не удалось создать ключ.",
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
      setMessage("Ключ отозван.");
      router.refresh();
    } catch (revokeError) {
      setError(
        revokeError instanceof Error
          ? revokeError.message
          : "Не удалось отозвать ключ.",
      );
    }
  }

  return (
    <div className="grid gap-5 2xl:grid-cols-[420px_minmax(0,1fr)]">
      <form
        className="social-shell rounded-[32px] p-6"
        onSubmit={form.handleSubmit((values) => void createInvite(values))}
      >
        <span className="eyebrow-pill">
          <KeyRound className="h-3.5 w-3.5" /> Новый ключ
        </span>
        <div className="mt-5 grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="label">Название</Label>
            <Input
              id="label"
              placeholder="Партнёрская волна"
              {...form.register("label")}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="role">Роль</Label>
              <select
                id="role"
                className="field-select text-sm"
                {...form.register("role")}
              >
                {roleOptions.map((option) => (
                  <option key={option} value={option}>
                    {roleLabels[option]}
                  </option>
                ))}
              </select>
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
            <Label htmlFor="expiresAt">Срок действия</Label>
            <Input
              id="expiresAt"
              type="datetime-local"
              {...form.register("expiresAt")}
            />
            <p className="text-xs text-[var(--text-muted)]">
              Оставьте пустым, чтобы ключ был бессрочным.
            </p>
          </div>
          <div className="surface-subtle rounded-[24px] p-4 text-sm leading-7 text-[var(--text-dim)]">
            <span className="inline-flex items-center gap-2 text-white">
              <ShieldCheck className="h-4 w-4 text-[var(--accent)]" />
              Маршрут доступа
            </span>
            <p className="mt-2">
              Ключ определяет тип онбординга, уровень доступа и жизненный цикл
              входа в платформу.
            </p>
          </div>
        </div>

        {latestRawCode ? (
          <div className="mt-5 rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.06] p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-100/80">
              Сырой ключ
            </p>
            <p className="mt-2 break-all font-mono text-sm text-white">
              {latestRawCode}
            </p>
          </div>
        ) : null}
        {error ? <p className="mt-4 text-sm text-rose-200">{error}</p> : null}
        {message ? (
          <p className="mt-4 text-sm text-emerald-200">{message}</p>
        ) : null}

        <div className="mt-5 flex gap-2">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Создаём..." : "Создать"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.refresh()}
          >
            Обновить
          </Button>
        </div>
      </form>

      <section className="social-shell rounded-[32px] p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="section-kicker">Последние ключи</p>
          <span className="status-pill">
            <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
            Контур доступа
          </span>
        </div>
        <div className="mt-5 grid gap-3">
          {invites.length === 0 ? (
            <EmptyState
              title="Ключей пока нет"
              description="Создайте первый ключ для онбординга владельцев, админов или участников."
            />
          ) : (
            invites.map((invite) => (
              <div key={invite.id} className="list-row rounded-[26px] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-medium text-white">
                      {invite.label ?? "Ключ без названия"}
                    </p>
                    <p className="mt-1 text-sm text-[var(--text-dim)]">
                      Роль {roleLabels[invite.role]} · Использовано{" "}
                      {invite.usedCount}/{invite.maxUses}
                    </p>
                    <p className="mt-2 text-xs text-[var(--text-muted)]">
                      {invite.revokedAt
                        ? `Отозван: ${new Date(invite.revokedAt).toLocaleString()}`
                        : invite.expiresAt
                          ? `Истекает: ${new Date(invite.expiresAt).toLocaleString()}`
                          : "Без ограничения срока"}
                    </p>
                  </div>
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
