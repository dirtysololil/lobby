"use client";

import { LockKeyhole, Plus, Waves } from "lucide-react";
import {
  hubListResponseSchema,
  hubSummarySchema,
  viewerHubInvitesResponseSchema,
  type HubInvite,
  type HubSummary,
} from "@lobby/shared";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  CompactList,
  CompactListCount,
  CompactListHeader,
  CompactListLink,
  CompactListMeta,
  CompactListRow,
} from "@/components/ui/compact-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClientFetch } from "@/lib/api-client";

const roleLabels: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MODERATOR: "Moderator",
  MEMBER: "Member",
};

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
      setErrorMessage(error instanceof Error ? error.message : "Unable to load hubs.");
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
      setErrorMessage(error instanceof Error ? error.message : "Unable to create hub.");
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
        error instanceof Error ? error.message : "Unable to process the invite.",
      );
    }
  }

  return (
    <section className="grid h-full min-h-0 grid-cols-1 gap-3 overflow-hidden px-3 py-3 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex min-h-0 flex-col overflow-hidden rounded-[22px] border border-[var(--border-soft)]">
        <div className="border-b border-[var(--border-soft)] px-4 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <CompactListMeta>
              <Waves size={14} strokeWidth={1.5} />
              Hubs
            </CompactListMeta>
            <CompactListMeta>{hubs.length} spaces</CompactListMeta>
            {invites.length > 0 ? <CompactListMeta>{invites.length} invites</CompactListMeta> : null}
          </div>
          <h2 className="mt-2 text-base font-semibold tracking-tight text-white">
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
              <CompactListHeader>
                <span>Invites</span>
                <CompactListCount>{invites.length}</CompactListCount>
              </CompactListHeader>
              <CompactList>
                {invites.map((invite) => (
                  <CompactListRow
                    key={invite.id}
                    compact
                    className="flex-col items-stretch gap-2 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium leading-tight text-white">
                          {invite.hub.name}
                        </p>
                        {invite.hub.isPrivate ? <CompactListCount>Private</CompactListCount> : null}
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
                  </CompactListRow>
                ))}
              </CompactList>
            </div>
          ) : null}

          <div>
            <CompactListHeader>
              <span>Your hubs</span>
              <CompactListCount>{hubs.length}</CompactListCount>
            </CompactListHeader>
            {hubs.length === 0 ? (
              <EmptyView
                title="No hubs yet"
                description="Create a space or accept an invite to get started."
              />
            ) : (
              <CompactList>
                {hubs.map((hub) => (
                  <CompactListLink
                    key={hub.id}
                    href={`/app/hubs/${hub.id}`}
                    className="gap-3"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-[var(--bg-panel-soft)] text-[10px] font-semibold text-white">
                      {hub.name.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium leading-tight text-white">
                          {hub.name}
                        </p>
                        <CompactListCount>
                          {roleLabels[hub.membershipRole ?? "MEMBER"] ?? "Member"}
                        </CompactListCount>
                        {hub.isPrivate ? (
                          <span className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]">
                            <LockKeyhole className="h-[16px] w-[16px]" />
                            Private
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 truncate text-xs leading-tight text-[var(--text-dim)]">
                        {hub.description ?? "No description yet."}
                      </p>
                    </div>
                  </CompactListLink>
                ))}
              </CompactList>
            )}
          </div>
        </div>
      </div>

      <aside className="premium-panel min-h-0 overflow-y-auto rounded-[22px] p-4">
        <div className="flex items-center gap-2">
          <CompactListMeta>
            <Plus size={14} strokeWidth={1.5} />
            New hub
          </CompactListMeta>
        </div>
        <h3 className="mt-2 text-base font-semibold tracking-tight text-white">Create space</h3>
        <p className="mt-1 text-sm text-[var(--text-dim)]">
          Keep it lightweight. Name it, slug it, and move into conversation.
        </p>

        <form className="mt-4 grid gap-2" onSubmit={handleCreateHub}>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Hub name"
            className="h-10"
          />
          <Input
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            placeholder="slug"
            className="h-10"
          />
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Short description"
            className="field-textarea min-h-[100px] text-sm"
          />
          <label className="field-checkbox text-sm">
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(event) => setIsPrivate(event.target.checked)}
            />
            Private hub
          </label>
          <Button type="submit" disabled={isSubmitting} className="h-10 w-full">
            {isSubmitting ? "Creating..." : "Create hub"}
          </Button>
        </form>
      </aside>
    </section>
  );
}
