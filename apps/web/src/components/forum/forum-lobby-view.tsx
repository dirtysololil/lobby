"use client";

import Link from "next/link";
import {
  forumTopicListResponseSchema,
  forumTopicResponseSchema,
  hubShellResponseSchema,
  type ForumTopic,
} from "@lobby/shared";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiClientFetch } from "@/lib/api-client";

interface ForumLobbyViewProps {
  hubId: string;
  lobbyId: string;
}

export function ForumLobbyView({ hubId, lobbyId }: ForumLobbyViewProps) {
  const [hub, setHub] = useState<ReturnType<typeof hubShellResponseSchema.parse>["hub"] | null>(null);
  const [topics, setTopics] = useState<ForumTopic[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [hubPayload, topicsPayload] = await Promise.all([
        apiClientFetch(`/v1/hubs/${hubId}`),
        apiClientFetch(`/v1/forum/hubs/${hubId}/lobbies/${lobbyId}/topics`),
      ]);

      setHub(hubShellResponseSchema.parse(hubPayload).hub);
      setTopics(forumTopicListResponseSchema.parse(topicsPayload).items);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load forum lobby");
    }
  }, [hubId, lobbyId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleCreateTopic(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const payload = await apiClientFetch(`/v1/forum/hubs/${hubId}/lobbies/${lobbyId}/topics`, {
        method: "POST",
        body: JSON.stringify({
          title,
          content,
          tags: tags
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
        }),
      });

      forumTopicResponseSchema.parse(payload);
      setTitle("");
      setContent("");
      setTags("");
      await loadData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to create topic");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (errorMessage) {
    return (
      <div className="rounded-3xl border border-rose-400/20 bg-rose-400/10 px-5 py-4 text-sm text-rose-100">
        {errorMessage}
      </div>
    );
  }

  if (!hub) {
    return (
      <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-5 text-sm text-slate-400">
        Loading forum...
      </div>
    );
  }

  const lobby = hub.lobbies.find((item) => item.id === lobbyId);

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{lobby?.name ?? "Forum lobby"}</CardTitle>
          <CardDescription>Topics are sorted by pinned state and last activity.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {hub.membershipRole && !hub.isViewerMuted ? (
            <form className="space-y-4 rounded-3xl border border-white/10 bg-slate-950/35 p-5" onSubmit={handleCreateTopic}>
              <p className="text-sm font-medium text-white">Create topic</p>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Topic title" />
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="Topic content"
                className="min-h-36 w-full rounded-3xl border border-white/10 bg-slate-950/50 px-4 py-4 text-sm text-white outline-none placeholder:text-slate-500"
              />
              <Input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="tags, comma-separated" />
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create topic"}
              </Button>
            </form>
          ) : (
            <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-5 text-sm text-slate-400">
              {hub.isViewerMuted
                ? "You are muted in this hub and cannot create forum content."
                : "Join the hub to create forum topics."}
            </div>
          )}

          <div className="space-y-3">
            {topics.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-5 text-sm text-slate-500">
                No topics yet.
              </div>
            ) : (
              topics.map((topic) => (
                <Link
                  key={topic.id}
                  href={`/app/hubs/${hubId}/forum/${lobbyId}/topics/${topic.id}`}
                  className="block rounded-3xl border border-white/10 bg-slate-950/35 p-5 transition hover:border-sky-300/20 hover:bg-white/[0.04]"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-base font-medium text-white">{topic.title}</p>
                      <p className="mt-1 text-sm text-slate-400">{topic.content}</p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        {topic.tags.map((tag) => (
                          <span key={tag.id} className="rounded-full border border-white/10 px-3 py-1 text-sky-200/70">
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {topic.pinned ? (
                        <span className="rounded-full border border-amber-300/20 px-3 py-1 text-amber-100/80">pinned</span>
                      ) : null}
                      {topic.locked ? (
                        <span className="rounded-full border border-white/10 px-3 py-1 text-slate-300">locked</span>
                      ) : null}
                      {topic.archived ? (
                        <span className="rounded-full border border-white/10 px-3 py-1 text-slate-300">archived</span>
                      ) : null}
                      <span className="rounded-full border border-white/10 px-3 py-1 text-sky-200/70">
                        replies {topic.repliesCount}
                      </span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
