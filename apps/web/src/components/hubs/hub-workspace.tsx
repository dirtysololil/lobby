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
import { Input } from "@/components/ui/input";
import { apiClientFetch } from "@/lib/api-client";

const roleLabels: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MODERATOR: "Moderator",
  MEMBER: "Member",
};

function CountBadge({ value }: { value: number | string }) {
  return (
    <span className="inline-flex min-h-5 items-center rounded-full bg-[var(--bg-panel-soft)] px-2 text-[11px] font-medium text-[var(--text-dim)]">
      {value}
    </span>
  );
}

function SectionHeader({
  title,
  count,
}: {
  title: string;
  count: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--border-soft)] px-3 py-2 text-xs text-[var(--text-dim)]">
      <span>{title}</span>
      <CountBadge value={count} />
    </div>
  );
}

function EmptyView({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="empty-state-minimal">
      <Waves className="h-5 w-5 text-[var(--text-muted)]" />
      <div>
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="mt-1 text-xs text-[var(--text-dim)]">{description}</p>
      </div>
    </div>
  );
}

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
        error instanceof Error ? error.message : "Unable to load hubs.",
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
        error instanceof Error ? error.message : "Unable to create hub.",
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
          : "Unable to process the invite.",
      );
    }
  }

  return (
    <section className="grid h-full min-h-0 overflow-hidden p-3 grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-h-0 flex-col">
        <div className="border-b border-[var(--border)] px-3 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="eyebrow-pill">
              <Waves className="h-[18px] w-[18px]" />
              Hubs
            </span>
            <span className="status-pill">{hubs.length} spaces</span>
            {invites.length > 0 ? (
              <span className="status-pill">{invites.length} invites</span>
            ) : null}
          </div>
          <h2 className="mt-1 text-base font-semibold tracking-tight text-white">
            Shared spaces
          </h2>
        </div>

        {errorMessage ? (
          <div className="border-b border-rose-400/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
            {errorMessage}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {invites.length > 0 ? (
            <div>
              <SectionHeader title="Invites" count={invites.length} />
              {invites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex flex-col gap-2 border-b border-[var(--border-soft)] px-3 py-2.5 transition-colors hover:bg-[var(--bg-hover)] lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium leading-tight text-white">
                        {invite.hub.name}
                      </p>
                      {invite.hub.isPrivate ? (
                        <CountBadge value="Private" />
                      ) : null}
                    </div>
                    <p className="mt-1 truncate text-xs text-[var(--text-dim)]">
                      Invited by {invite.invitedBy.profile.displayName}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      size="sm"
                      onClick={() => void handleInviteAction(invite.id, "accept")}
                      className="h-8 px-2.5"
                    >
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void handleInviteAction(invite.id, "decline")}
                      className="h-8 px-2.5"
                    >
                      Decline
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          <div>
            <SectionHeader title="Your hubs" count={hubs.length} />
            {hubs.length === 0 ? (
              <EmptyView
                title="No hubs yet"
                description="Create a space or accept an invite to get started."
              />
            ) : (
              hubs.map((hub) => (
                <Link
                  key={hub.id}
                  href={`/app/hubs/${hub.id}`}
                  className="flex items-start gap-3 border-b border-[var(--border-soft)] px-3 py-2.5 transition-colors hover:bg-[var(--bg-hover)]"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--bg-panel-soft)] text-[11px] font-semibold text-white">
                    {hub.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium leading-tight text-white">
                        {hub.name}
                      </p>
                      <CountBadge
                        value={roleLabels[hub.membershipRole ?? "MEMBER"] ?? "Member"}
                      />
                      {hub.isPrivate ? (
                        <span className="inline-flex items-center gap-1 text-xs text-[var(--text-dim)]">
                          <LockKeyhole className="h-[18px] w-[18px]" />
                          Private
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 truncate text-xs leading-tight text-[var(--text-dim)]">
                      {hub.description ?? "No description yet."}
                    </p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      <aside className="min-h-0 overflow-y-auto rounded-[22px] border border-[var(--border)] bg-[rgba(14,21,30,0.72)] xl:border">
        <div className="border-b border-[var(--border)] px-3 py-3">
          <div className="flex items-center gap-2">
            <span className="eyebrow-pill">
              <Plus className="h-[18px] w-[18px]" />
              New hub
            </span>
          </div>
          <h3 className="mt-1 text-base font-semibold tracking-tight text-white">
            Create space
          </h3>
        </div>

        <form className="grid gap-2 px-3 py-3" onSubmit={handleCreateHub}>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Hub name"
            className="h-9"
          />
          <Input
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            placeholder="slug"
            className="h-9"
          />
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Short description"
            className="field-textarea min-h-24 text-sm"
          />
          <label className="field-checkbox text-sm">
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(event) => setIsPrivate(event.target.checked)}
            />
            Private hub
          </label>
          <Button type="submit" disabled={isSubmitting} className="h-9 w-full">
            {isSubmitting ? "Creating..." : "Create hub"}
          </Button>
        </form>
      </aside>
    </section>
  );
}
