"use client";

import Link from "next/link";
import { hubListResponseSchema, hubSummarySchema, viewerHubInvitesResponseSchema, type HubInvite, type HubSummary } from "@lobby/shared";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiClientFetch } from "@/lib/api-client";

export function HubWorkspace() {
  const [hubs, setHubs] = useState<HubSummary[]>([]);
  const [invites, setInvites] = useState<HubInvite[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);

  const loadWorkspace = useCallback(async () => {
    try {
      const [hubsPayload, invitesPayload] = await Promise.all([apiClientFetch("/v1/hubs"), apiClientFetch("/v1/hubs/invites/me")]);
      setHubs(hubListResponseSchema.parse(hubsPayload).items);
      setInvites(viewerHubInvitesResponseSchema.parse(invitesPayload).items);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось загрузить хабы");
    }
  }, []);

  useEffect(() => { void loadWorkspace(); }, [loadWorkspace]);

  async function handleCreateHub(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = await apiClientFetch("/v1/hubs", { method: "POST", body: JSON.stringify({ name, slug, description: description || null, isPrivate }) });
      const createdHub = hubSummarySchema.parse(payload);
      setHubs((current) => [...current, createdHub]);
      setName(""); setSlug(""); setDescription(""); setIsPrivate(false); setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось создать хаб");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleInviteAction(inviteId: string, action: "accept" | "decline") {
    try {
      await apiClientFetch(`/v1/hubs/invites/${inviteId}/${action}`, { method: "POST" });
      await loadWorkspace();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось обработать приглашение");
    }
  }

  return (
    <section className="grid gap-5 2xl:grid-cols-[420px_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle>Создание хаба</CardTitle>
          <CardDescription>Создатель сразу получает роль владельца.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={handleCreateHub}>
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Название хаба" />
            <Input value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="slug-хаба" />
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Короткое описание" className="min-h-28 w-full rounded-2xl border border-[var(--border)] bg-slate-950/60 px-4 py-3 text-sm text-white outline-none placeholder:text-[var(--text-muted)]" />
            <label className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-slate-950/45 px-4 py-3 text-sm text-slate-200">
              <input type="checkbox" checked={isPrivate} onChange={(event) => setIsPrivate(event.target.checked)} />
              Приватный хаб
            </label>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Создаём..." : "Создать хаб"}</Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-5">
        {errorMessage ? <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{errorMessage}</div> : null}

        <Card>
          <CardHeader>
            <CardTitle>Приглашения в хабы</CardTitle>
            <CardDescription>Запросы на вступление в приватные и открытые пространства.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {invites.length === 0 ? <div className="rounded-2xl border border-[var(--border)] bg-[#0b1322]/70 p-4 text-sm text-[var(--text-muted)]">Нет активных приглашений.</div> : invites.map((invite) => (
              <div key={invite.id} className="rounded-2xl border border-[var(--border)] bg-[#0b1322]/70 p-4">
                <p className="text-base font-medium text-white">{invite.hub.name}</p>
                <p className="mt-1 text-sm text-[var(--text-dim)]">Пригласил: {invite.invitedBy.profile.displayName}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => void handleInviteAction(invite.id, "accept")}>Принять</Button>
                  <Button size="sm" variant="secondary" onClick={() => void handleInviteAction(invite.id, "decline")}>Отклонить</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ваши хабы</CardTitle>
            <CardDescription>Рабочие пространства, к которым у вас есть доступ.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {hubs.length === 0 ? <div className="rounded-2xl border border-[var(--border)] bg-[#0b1322]/70 p-4 text-sm text-[var(--text-muted)]">Вы пока не состоите ни в одном хабе.</div> : hubs.map((hub) => (
              <Link key={hub.id} href={`/app/hubs/${hub.id}`} className="block rounded-2xl border border-[var(--border)] bg-[#0b1322]/70 p-4 transition hover:border-[var(--border-strong)] hover:bg-white/[0.04]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-base font-medium text-white">{hub.name}</p>
                    <p className="mt-1 text-sm text-[var(--text-dim)]">{hub.description ?? "Описание не задано"}</p>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <span className="rounded-full border border-[var(--border)] px-3 py-1 text-[#aaccf5]">{hub.membershipRole ?? "MEMBER"}</span>
                    {hub.isPrivate ? <span className="rounded-full border border-amber-300/20 px-3 py-1 text-amber-100/80">Приватный</span> : null}
                  </div>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
