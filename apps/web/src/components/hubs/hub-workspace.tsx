"use client";

import Link from "next/link";
import { LockKeyhole, Plus, Waves } from "lucide-react";
import {
  hubListResponseSchema,
  hubSummarySchema,
  viewerHubInvitesResponseSchema,
  type HubInvite,
  type HubSummary,
} from "@lobby/shared";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { apiClientFetch } from "@/lib/api-client";

const roleLabels: Record<string, string> = {
  OWNER: "Владелец",
  ADMIN: "Администратор",
  MODERATOR: "Модератор",
  MEMBER: "Участник",
};

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
      const [hubsPayload, invitesPayload] = await Promise.all([
        apiClientFetch("/v1/hubs"),
        apiClientFetch("/v1/hubs/invites/me"),
      ]);
      setHubs(hubListResponseSchema.parse(hubsPayload).items);
      setInvites(viewerHubInvitesResponseSchema.parse(invitesPayload).items);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Не удалось загрузить хабы",
      );
    }
  }, []);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  async function handleCreateHub(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = await apiClientFetch("/v1/hubs", {
        method: "POST",
        body: JSON.stringify({
          name,
          slug,
          description: description || null,
          isPrivate,
        }),
      });
      const createdHub = hubSummarySchema.parse(payload);
      setHubs((current) => [...current, createdHub]);
      setName("");
      setSlug("");
      setDescription("");
      setIsPrivate(false);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Не удалось создать хаб",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleInviteAction(
    inviteId: string,
    action: "accept" | "decline",
  ) {
    try {
      await apiClientFetch(`/v1/hubs/invites/${inviteId}/${action}`, {
        method: "POST",
      });
      await loadWorkspace();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не удалось обработать приглашение",
      );
    }
  }

  return (
    <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="grid gap-3">
        <div className="social-shell rounded-[20px] p-3">
          <div className="compact-toolbar">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="eyebrow-pill">
                  <Waves className="h-3.5 w-3.5" />
                  Hubs
                </span>
                <span className="status-pill">{hubs.length} spaces</span>
                {invites.length > 0 ? (
                  <span className="status-pill">{invites.length} invites</span>
                ) : null}
              </div>
              <h2 className="mt-1.5 font-[var(--font-heading)] text-[1.15rem] font-semibold tracking-[-0.04em] text-white">
                Hubs
              </h2>
            </div>
          </div>
        </div>

        {errorMessage ? (
          <div className="rounded-[16px] border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            {errorMessage}
          </div>
        ) : null}

        {invites.length > 0 ? (
          <div className="premium-panel rounded-[20px] p-3">
            <div className="compact-toolbar px-1">
              <p className="section-kicker">Invites</p>
              <span className="glass-badge">{invites.length}</span>
            </div>
            <div className="mt-2 grid gap-2">
              {invites.map((invite) => (
                <div key={invite.id} className="list-row rounded-[16px] px-3 py-2.5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-white">
                          {invite.hub.name}
                        </p>
                        {invite.hub.isPrivate ? (
                          <span className="glass-badge">
                            <LockKeyhole className="h-3 w-3" />
                            Private
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-[var(--text-dim)]">
                        Пригласил {invite.invitedBy.profile.displayName}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => void handleInviteAction(invite.id, "accept")}
                      >
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void handleInviteAction(invite.id, "decline")}
                      >
                        Decline
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="premium-panel rounded-[20px] p-3">
          <div className="compact-toolbar px-1">
            <p className="section-kicker">Your hubs</p>
            <span className="glass-badge">{hubs.length}</span>
          </div>
          <div className="mt-2 grid gap-2">
            {hubs.length === 0 ? (
              <EmptyState
                title="Нет доступных хабов"
                description="Создайте первое пространство или примите приглашение."
              />
            ) : (
              hubs.map((hub) => (
                <Link
                  key={hub.id}
                  href={`/app/hubs/${hub.id}`}
                  className="list-row rounded-[16px] px-3 py-2.5"
                >
                  <div className="flex items-start gap-3">
                    <span className="dock-icon flex h-9 w-9 items-center justify-center rounded-[12px] text-[10px] font-semibold text-white">
                      {hub.name.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-white">
                          {hub.name}
                        </p>
                        <span className="glass-badge">
                          {roleLabels[hub.membershipRole ?? "MEMBER"] ?? "Участник"}
                        </span>
                        {hub.isPrivate ? (
                          <span className="glass-badge">Private</span>
                        ) : null}
                      </div>
                      <p className="mt-1 truncate text-sm text-[var(--text-dim)]">
                        {hub.description ?? "Без описания"}
                      </p>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="premium-panel rounded-[20px] p-3.5">
        <div className="compact-toolbar">
          <div>
            <p className="section-kicker">Create hub</p>
          </div>
          <span className="glass-badge">
            <Plus className="h-3 w-3" />
            New
          </span>
        </div>

        <form className="mt-3 grid gap-2.5" onSubmit={handleCreateHub}>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Название хаба"
          />
          <Input
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            placeholder="slug"
          />
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Короткое описание"
            className="field-textarea"
          />
          <label className="field-checkbox text-sm">
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(event) => setIsPrivate(event.target.checked)}
            />
            Private hub
          </label>
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Создаем..." : "Создать хаб"}
          </Button>
        </form>
      </div>
    </section>
  );
}
