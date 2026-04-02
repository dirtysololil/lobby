"use client";

import Link from "next/link";
import {
  hubListResponseSchema,
  hubSummarySchema,
  viewerHubInvitesResponseSchema,
  type HubInvite,
  type HubSummary,
} from "@lobby/shared";
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
      const [hubsPayload, invitesPayload] = await Promise.all([
        apiClientFetch("/v1/hubs"),
        apiClientFetch("/v1/hubs/invites/me"),
      ]);

      setHubs(hubListResponseSchema.parse(hubsPayload).items);
      setInvites(viewerHubInvitesResponseSchema.parse(invitesPayload).items);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load hubs");
    }
  }, []);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  async function handleCreateHub(event: React.FormEvent<HTMLFormElement>) {
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
      setErrorMessage(error instanceof Error ? error.message : "Unable to create hub");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleInviteAction(inviteId: string, action: "accept" | "decline") {
    try {
      await apiClientFetch(`/v1/hubs/invites/${inviteId}/${action}`, {
        method: "POST",
      });

      await loadWorkspace();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to process hub invite");
    }
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[0.44fr_0.56fr]">
      <Card>
        <CardHeader>
          <CardTitle>Create hub</CardTitle>
          <CardDescription>Owner role is assigned to the creator immediately.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleCreateHub}>
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Hub name" />
            <Input value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="hub-slug" />
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Description"
              className="min-h-28 w-full rounded-3xl border border-white/10 bg-slate-950/50 px-4 py-4 text-sm text-white outline-none placeholder:text-slate-500"
            />
            <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3 text-sm text-slate-200">
              <input type="checkbox" checked={isPrivate} onChange={(event) => setIsPrivate(event.target.checked)} />
              Private hub
            </label>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create hub"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-6">
        {errorMessage ? (
          <div className="rounded-3xl border border-rose-400/20 bg-rose-400/10 px-5 py-4 text-sm text-rose-100">
            {errorMessage}
          </div>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Pending hub invites</CardTitle>
            <CardDescription>Private hubs and invited memberships land here.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {invites.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-5 text-sm text-slate-500">
                No pending hub invites.
              </div>
            ) : (
              invites.map((invite) => (
                <div key={invite.id} className="rounded-3xl border border-white/10 bg-slate-950/35 p-5">
                  <p className="text-base font-medium text-white">{invite.hub.name}</p>
                  <p className="mt-1 text-sm text-slate-400">
                    invited by {invite.invitedBy.profile.displayName}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => void handleInviteAction(invite.id, "accept")}>
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
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your hubs</CardTitle>
            <CardDescription>Joined hubs appear in the global sidebar and here.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {hubs.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-5 text-sm text-slate-500">
                You are not a member of any hub yet.
              </div>
            ) : (
              hubs.map((hub) => (
                <Link
                  key={hub.id}
                  href={`/app/hubs/${hub.id}`}
                  className="block rounded-3xl border border-white/10 bg-slate-950/35 p-5 transition hover:border-sky-300/20 hover:bg-white/[0.04]"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-base font-medium text-white">{hub.name}</p>
                      <p className="mt-1 text-sm text-slate-400">{hub.description ?? "No description yet."}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full border border-white/10 px-3 py-1 text-sky-200/70">
                        {hub.membershipRole}
                      </span>
                      {hub.isPrivate ? (
                        <span className="rounded-full border border-amber-300/20 px-3 py-1 text-amber-100/80">
                          private
                        </span>
                      ) : null}
                    </div>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
