"use client";

import Link from "next/link";
import { Clock3, MessageSquareQuote, Pin, Tags, Waves } from "lucide-react";
import {
  forumTopicListResponseSchema,
  forumTopicResponseSchema,
  type ForumTopic,
  type HubShell,
} from "@lobby/shared";
import { useCallback, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { HubShellBootstrap } from "@/components/hubs/hub-shell-bootstrap";
import { apiClientFetch } from "@/lib/api-client";

interface ForumLobbyViewProps {
  hub: HubShell["hub"];
  hubId: string;
  lobbyId: string;
  initialTopics: ForumTopic[];
}

function formatTopicDate(value: string) {
  return new Date(value).toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ForumLobbyView({
  hub,
  hubId,
  lobbyId,
  initialTopics,
}: ForumLobbyViewProps) {
  const [topics, setTopics] = useState<ForumTopic[]>(initialTopics);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadTopics = useCallback(async () => {
    try {
      const topicsPayload = await apiClientFetch(
        `/v1/forum/hubs/${hubId}/lobbies/${lobbyId}/topics`,
      );
      setTopics(forumTopicListResponseSchema.parse(topicsPayload).items);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ С„РѕСЂСѓРј",
      );
    }
  }, [hubId, lobbyId]);

  async function handleCreateTopic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = await apiClientFetch(
        `/v1/forum/hubs/${hubId}/lobbies/${lobbyId}/topics`,
        {
          method: "POST",
          body: JSON.stringify({
            title,
            content,
            tags: tags
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean),
          }),
        },
      );
      forumTopicResponseSchema.parse(payload);
      setTitle("");
      setContent("");
      setTags("");
      await loadTopics();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕР·РґР°С‚СЊ С‚РµРјСѓ",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (errorMessage) {
    return (
      <div className="rounded-[16px] border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
        {errorMessage}
      </div>
    );
  }

  const lobby = hub.lobbies.find((item) => item.id === lobbyId);
  const canCreateTopic = Boolean(hub.membershipRole) && !hub.isViewerMuted;

  return (
    <div className="h-full min-h-0 overflow-y-auto px-3 py-3">
      <HubShellBootstrap hub={hub} />
      <div className="mx-auto grid max-w-[1120px] gap-3">
        <section className="social-shell rounded-[24px] p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="eyebrow-pill">
              <Waves className="h-3.5 w-3.5" />
              Forum
            </span>
            <span className="status-pill">{topics.length} topics</span>
            <span className="status-pill">
              {topics.filter((topic) => topic.pinned).length} pinned
            </span>
          </div>
          <h1 className="mt-3 text-xl font-semibold tracking-[-0.04em] text-white">
            {lobby?.name ?? "Р¤РѕСЂСѓРј"}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-dim)]">
            РљРѕРјРїР°РєС‚РЅС‹Р№ thread-based СЃРїРёСЃРѕРє С‚РµРј СЃ РѕС‚РІРµС‚Р°РјРё, С‚РµРіР°РјРё Рё РїРѕРЅСЏС‚РЅС‹Рј РёРµСЂР°СЂС…РёС‡РµСЃРєРёРј СЂРёС‚РјРѕРј.
          </p>
        </section>

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="premium-panel rounded-[24px] p-4">
            <div className="compact-toolbar">
              <div>
                <p className="section-kicker">Темы</p>
                <p className="mt-2 text-sm text-[var(--text-dim)]">
                  Последняя активность и статус каждой темы считываются с одного взгляда.
                </p>
              </div>
              <span className="glass-badge">{topics.length}</span>
            </div>

            <div className="mt-4 grid gap-2">
              {topics.length === 0 ? (
                <EmptyState
                  title="РўРµРј РїРѕРєР° РЅРµС‚"
                  description="РЎРѕР·РґР°Р№С‚Рµ РїРµСЂРІСѓСЋ С‚РµРјСѓ РёР»Рё РґРѕР¶РґРёС‚РµСЃСЊ РЅРѕРІРѕР№ Р°РєС‚РёРІРЅРѕСЃС‚Рё РІ СЌС‚РѕРј С„РѕСЂСѓРјРµ."
                />
              ) : (
                topics.map((topic) => (
                  <Link
                    key={topic.id}
                    href={`/app/hubs/${hubId}/forum/${lobbyId}/topics/${topic.id}`}
                    className="rounded-[18px] border border-[var(--border-soft)] bg-white/[0.03] px-4 py-3 transition-colors hover:border-[var(--border)] hover:bg-white/[0.05]"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-white">
                            {topic.title}
                          </p>
                          {topic.pinned ? (
                            <span className="glass-badge">
                              <Pin className="h-3 w-3" />
                              Pinned
                            </span>
                          ) : null}
                          {topic.locked ? <span className="glass-badge">Locked</span> : null}
                          {topic.archived ? <span className="glass-badge">Archived</span> : null}
                        </div>

                        <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-[var(--text-soft)]">
                          {topic.content}
                        </p>

                        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)]">
                          <span>{topic.author.profile.displayName}</span>
                          <span className="inline-flex items-center gap-1">
                            <Clock3 className="h-3.5 w-3.5" />
                            {formatTopicDate(topic.lastActivityAt)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <MessageSquareQuote className="h-3.5 w-3.5" />
                            {topic.repliesCount}
                          </span>
                        </div>

                        {topic.tags.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {topic.tags.map((tag) => (
                              <span key={tag.id} className="glass-badge">
                                <Tags className="h-3 w-3" />
                                {tag.name}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </section>

          <aside className="grid gap-3">
            <section className="premium-panel rounded-[24px] p-4">
              <p className="section-kicker">Новая тема</p>
              {canCreateTopic ? (
                <form className="mt-3 grid gap-2.5" onSubmit={handleCreateTopic}>
                  <Input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Р—Р°РіРѕР»РѕРІРѕРє С‚РµРјС‹"
                  />
                  <textarea
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    placeholder="РћСЃРЅРѕРІРЅР°СЏ РјС‹СЃР»СЊ, РєРѕРЅС‚РµРєСЃС‚ Рё РІРѕРїСЂРѕСЃ"
                    className="field-textarea min-h-[120px]"
                  />
                  <Input
                    value={tags}
                    onChange={(event) => setTags(event.target.value)}
                    placeholder="Теги через запятую"
                  />
                  <Button type="submit" disabled={isSubmitting} className="h-10 w-full">
                    {isSubmitting ? "РџСѓР±Р»РёРєСѓРµРј..." : "РЎРѕР·РґР°С‚СЊ С‚РµРјСѓ"}
                  </Button>
                </form>
              ) : (
                <div className="mt-3 rounded-[18px] border border-[var(--border-soft)] bg-white/[0.03] px-4 py-3 text-sm leading-6 text-[var(--text-soft)]">
                  {hub.isViewerMuted
                    ? "Р’С‹ РѕРіСЂР°РЅРёС‡РµРЅС‹ РІ СЌС‚РѕРј С…Р°Р±Рµ Рё РЅРµ РјРѕР¶РµС‚Рµ СЃРѕР·РґР°РІР°С‚СЊ С‚РµРјС‹."
                    : "Р’СЃС‚СѓРїРёС‚Рµ РІ С…Р°Р±, С‡С‚РѕР±С‹ СЃРѕР·РґР°РІР°С‚СЊ С‚РµРјС‹ Рё СѓС‡Р°СЃС‚РІРѕРІР°С‚СЊ РІ РѕР±СЃСѓР¶РґРµРЅРёРё."}
                </div>
              )}
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
