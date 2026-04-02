"use client";

import {
  forumReplyResponseSchema,
  forumTopicDetailSchema,
  forumTopicResponseSchema,
  hubShellResponseSchema,
} from "@lobby/shared";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClientFetch } from "@/lib/api-client";

interface ForumTopicViewProps {
  hubId: string;
  lobbyId: string;
  topicId: string;
}

export function ForumTopicView({ hubId, lobbyId, topicId }: ForumTopicViewProps) {
  const [hub, setHub] = useState<ReturnType<typeof hubShellResponseSchema.parse>["hub"] | null>(null);
  const [topic, setTopic] = useState<ReturnType<typeof forumTopicDetailSchema.parse>["topic"] | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionKey, setActionKey] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [hubPayload, topicPayload] = await Promise.all([
        apiClientFetch(`/v1/hubs/${hubId}`),
        apiClientFetch(`/v1/forum/hubs/${hubId}/lobbies/${lobbyId}/topics/${topicId}`),
      ]);

      setHub(hubShellResponseSchema.parse(hubPayload).hub);
      setTopic(forumTopicDetailSchema.parse(topicPayload).topic);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load forum topic");
    }
  }, [hubId, lobbyId, topicId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleReply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionKey("reply");

    try {
      const payload = await apiClientFetch(`/v1/forum/hubs/${hubId}/lobbies/${lobbyId}/topics/${topicId}/replies`, {
        method: "POST",
        body: JSON.stringify({
          content: replyContent,
        }),
      });

      forumReplyResponseSchema.parse(payload);
      setReplyContent("");
      await loadData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to reply");
    } finally {
      setActionKey(null);
    }
  }

  async function toggleState(key: "pinned" | "locked" | "archived", value: boolean) {
    setActionKey(key);

    try {
      const payload = await apiClientFetch(`/v1/forum/hubs/${hubId}/lobbies/${lobbyId}/topics/${topicId}/state`, {
        method: "PATCH",
        body: JSON.stringify({
          [key]: value,
        }),
      });

      forumTopicResponseSchema.parse(payload);
      await loadData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update topic state");
    } finally {
      setActionKey(null);
    }
  }

  if (errorMessage) {
    return (
      <div className="rounded-3xl border border-rose-400/20 bg-rose-400/10 px-5 py-4 text-sm text-rose-100">
        {errorMessage}
      </div>
    );
  }

  if (!hub || !topic) {
    return (
      <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-5 text-sm text-slate-400">
        Loading topic...
      </div>
    );
  }

  const canReply = Boolean(hub.membershipRole) && !hub.isViewerMuted && !topic.locked && !topic.archived;

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{topic.title}</CardTitle>
          <CardDescription>
            by {topic.author.profile.displayName} with last activity at {new Date(topic.lastActivityAt).toLocaleString()}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
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
            {topic.tags.map((tag) => (
              <span key={tag.id} className="rounded-full border border-white/10 px-3 py-1 text-sky-200/70">
                {tag.name}
              </span>
            ))}
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-5 whitespace-pre-wrap text-sm leading-7 text-slate-200">
            {topic.content}
          </div>

          {hub.permissions.canModerateForum ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => void toggleState("pinned", !topic.pinned)} disabled={actionKey === "pinned"}>
                {topic.pinned ? "Unpin" : "Pin"}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => void toggleState("locked", !topic.locked)} disabled={actionKey === "locked"}>
                {topic.locked ? "Unlock" : "Lock"}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => void toggleState("archived", !topic.archived)} disabled={actionKey === "archived"}>
                {topic.archived ? "Unarchive" : "Archive"}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Replies</CardTitle>
          <CardDescription>Replies are blocked when the topic is locked or archived.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {canReply ? (
            <form className="space-y-3 rounded-3xl border border-white/10 bg-slate-950/35 p-5" onSubmit={handleReply}>
              <textarea
                value={replyContent}
                onChange={(event) => setReplyContent(event.target.value)}
                placeholder="Write a reply"
                className="min-h-28 w-full rounded-3xl border border-white/10 bg-slate-950/50 px-4 py-4 text-sm text-white outline-none placeholder:text-slate-500"
              />
              <Button type="submit" disabled={actionKey === "reply"}>
                {actionKey === "reply" ? "Replying..." : "Reply"}
              </Button>
            </form>
          ) : (
            <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-5 text-sm text-slate-400">
              {hub.isViewerMuted
                ? "You are muted in this hub."
                : topic.locked || topic.archived
                  ? "Replies are disabled for this topic."
                  : "Join the hub to reply."}
            </div>
          )}

          {topic.replies.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-5 text-sm text-slate-500">
              No replies yet.
            </div>
          ) : (
            topic.replies.map((reply) => (
              <div key={reply.id} className="rounded-3xl border border-white/10 bg-slate-950/35 p-5">
                <p className="text-sm font-medium text-white">{reply.author.profile.displayName}</p>
                <p className="font-mono text-xs text-sky-200/75">@{reply.author.username}</p>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-200">{reply.content}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
