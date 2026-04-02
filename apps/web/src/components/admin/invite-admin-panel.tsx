"use client";

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

export function InviteAdminPanel({ invites }: InviteAdminPanelProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [latestRawCode, setLatestRawCode] = useState<string | null>(null);
  const form = useForm<InviteFormValues>({
    defaultValues: {
      label: "",
      role: "MEMBER",
      maxUses: 1,
      expiresAt: "",
    },
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
        expiresAt: values.expiresAt ? new Date(values.expiresAt).toISOString() : null,
      });
      const response = inviteCreateResponseSchema.parse(
        await apiClientFetch("/v1/invites", {
          method: "POST",
          body: JSON.stringify(payload),
        }),
      );
      setLatestRawCode(response.rawCode);
      setMessage("Invite key created.");
      form.reset({
        label: "",
        role: values.role,
        maxUses: 1,
        expiresAt: "",
      });
      router.refresh();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Invite create failed");
    }
  }

  async function revokeInvite(inviteId: string) {
    setError(null);
    setMessage(null);

    try {
      await apiClientFetch(`/v1/invites/${inviteId}/revoke`, {
        method: "POST",
      });
      setMessage("Invite revoked.");
      router.refresh();
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : "Invite revoke failed");
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <form
        className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 shadow-[var(--shadow)] backdrop-blur-xl"
        onSubmit={form.handleSubmit((values) => void createInvite(values))}
      >
        <p className="font-mono text-xs uppercase tracking-[0.26em] text-sky-200/70">Create invite</p>
        <div className="mt-6 grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="label">Label</Label>
            <Input id="label" placeholder="Owner weekend batch" {...form.register("label")} />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="role">Role</Label>
              <select
                id="role"
                className="h-12 rounded-2xl border border-white/10 bg-slate-950/50 px-4 text-sm text-white outline-none"
                {...form.register("role")}
              >
                {roleOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="maxUses">Max uses</Label>
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
            <Label htmlFor="expiresAt">Expires at</Label>
            <Input id="expiresAt" type="datetime-local" {...form.register("expiresAt")} />
            <p className="text-xs text-slate-500">Leave empty for a non-expiring invite.</p>
          </div>
        </div>

        {latestRawCode ? (
          <div className="mt-6 rounded-3xl border border-emerald-300/15 bg-emerald-300/[0.06] p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-emerald-100/80">Raw key</p>
            <p className="mt-2 break-all font-mono text-sm text-white">{latestRawCode}</p>
          </div>
        ) : null}

        {error ? <p className="mt-5 text-sm text-rose-200">{error}</p> : null}
        {message ? <p className="mt-5 text-sm text-emerald-200">{message}</p> : null}

        <div className="mt-6 flex gap-3">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Creating..." : "Create invite"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => router.refresh()}>
            Refresh
          </Button>
        </div>
      </form>

      <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 shadow-[var(--shadow)] backdrop-blur-xl">
        <p className="font-mono text-xs uppercase tracking-[0.26em] text-sky-200/70">Recent invite keys</p>
        <div className="mt-6 grid gap-4">
          {invites.length === 0 ? (
            <EmptyState
              title="No invite keys yet"
              description="Create the first access key for owner, admin or member onboarding."
            />
          ) : (
            invites.map((invite) => (
              <div key={invite.id} className="rounded-3xl border border-white/10 bg-slate-950/35 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-base font-medium text-white">{invite.label ?? "Unnamed invite"}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      Role {invite.role} · Used {invite.usedCount}/{invite.maxUses}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      {invite.revokedAt
                        ? `Revoked at ${new Date(invite.revokedAt).toLocaleString()}`
                        : invite.expiresAt
                          ? `Expires ${new Date(invite.expiresAt).toLocaleString()}`
                          : "No expiration"}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => void revokeInvite(invite.id)}
                    disabled={Boolean(invite.revokedAt)}
                  >
                    {invite.revokedAt ? "Revoked" : "Revoke"}
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
