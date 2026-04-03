"use client";

import Link from "next/link";
import {
  Building2,
  LockKeyhole,
  Plus,
  Sparkles,
  UsersRound,
  Waves,
} from "lucide-react";
import {
  hubListResponseSchema,
  hubSummarySchema,
  viewerHubInvitesResponseSchema,
  type HubInvite,
  type HubSummary,
} from "@lobby/shared";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    <section className="grid gap-5 2xl:grid-cols-[420px_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <span className="eyebrow-pill">
            <Plus className="h-3.5 w-3.5" /> Новый хаб
          </span>
          <CardTitle>Создание хаба</CardTitle>
          <CardDescription>
            Сформируйте новое пространство для приватного сообщества, рабочих
            обсуждений и управляемых лобби.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={handleCreateHub}>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Название хаба"
            />
            <Input
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              placeholder="slug-хаба"
            />
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Короткое описание"
              className="field-textarea min-h-28"
            />
            <label className="surface-subtle flex items-center gap-3 rounded-[22px] px-4 py-3 text-sm text-[var(--text-soft)]">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(event) => setIsPrivate(event.target.checked)}
              />
              Приватный хаб
            </label>
            <div className="surface-subtle rounded-[24px] p-4 text-sm leading-7 text-[var(--text-dim)]">
              Создатель автоматически получает роль владельца, а структура
              пространства может быть сразу расширена текстовыми, голосовыми и
              форумными лобби.
            </div>
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? "Создаём пространство..." : "Создать хаб"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-5">
        {errorMessage ? (
          <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            {errorMessage}
          </div>
        ) : null}

        <Card>
          <CardHeader>
            <p className="section-kicker">Экосистема хабов</p>
            <CardTitle>Ваше пространство сообщества</CardTitle>
            <CardDescription>
              Lobby строит не набор карточек, а сетку приватных зон: хабы,
              лобби, люди и доступы читаются как единая социальная архитектура.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="surface-subtle rounded-[26px] p-5">
              <Building2 className="h-5 w-5 text-[var(--accent)]" />
              <p className="mt-4 text-base font-semibold text-white">Хабы</p>
              <p className="mt-2 text-sm leading-7 text-[var(--text-dim)]">
                Корневые пространства для команд, клубов и закрытых приватных
                зон.
              </p>
            </div>
            <div className="surface-subtle rounded-[26px] p-5">
              <UsersRound className="h-5 w-5 text-[var(--accent)]" />
              <p className="mt-4 text-base font-semibold text-white">
                Участники
              </p>
              <p className="mt-2 text-sm leading-7 text-[var(--text-dim)]">
                Роли, приглашения, модерация и видимая иерархия сообщества.
              </p>
            </div>
            <div className="surface-subtle rounded-[26px] p-5">
              <Waves className="h-5 w-5 text-[var(--accent)]" />
              <p className="mt-4 text-base font-semibold text-white">
                Лобби и форумы
              </p>
              <p className="mt-2 text-sm leading-7 text-[var(--text-dim)]">
                Каждый хаб мгновенно разворачивается в рабочую структуру общения
                и обсуждений.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <span className="eyebrow-pill">
              <Sparkles className="h-3.5 w-3.5" /> Приглашения
            </span>
            <CardTitle>Приглашения в хабы</CardTitle>
            <CardDescription>
              Запросы на вступление в приватные и открытые пространства.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {invites.length === 0 ? (
              <div className="surface-subtle rounded-[24px] p-4 text-sm text-[var(--text-muted)]">
                Нет активных приглашений.
              </div>
            ) : (
              invites.map((invite) => (
                <div key={invite.id} className="list-row rounded-[26px] p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-medium text-white">
                      {invite.hub.name}
                    </p>
                    {invite.hub.isPrivate ? (
                      <span className="glass-badge">
                        <LockKeyhole className="h-3 w-3" /> приватный
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-[var(--text-dim)]">
                    Пригласил: {invite.invitedBy.profile.displayName}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() =>
                        void handleInviteAction(invite.id, "accept")
                      }
                    >
                      Принять
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        void handleInviteAction(invite.id, "decline")
                      }
                    >
                      Отклонить
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <span className="eyebrow-pill">
              <Waves className="h-3.5 w-3.5" /> Активные пространства
            </span>
            <CardTitle>Ваши хабы</CardTitle>
            <CardDescription>
              Рабочие пространства, к которым у вас есть доступ.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {hubs.length === 0 ? (
              <div className="surface-subtle rounded-[24px] p-4 text-sm text-[var(--text-muted)]">
                Вы пока не состоите ни в одном хабе.
              </div>
            ) : (
              hubs.map((hub) => (
                <Link
                  key={hub.id}
                  href={`/app/hubs/${hub.id}`}
                  className="list-row block rounded-[26px] p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-base font-medium text-white">
                        {hub.name}
                      </p>
                      <p className="mt-1 text-sm text-[var(--text-dim)]">
                        {hub.description ?? "Описание не задано"}
                      </p>
                    </div>
                    <div className="flex gap-2 text-xs">
                      <span className="glass-badge">
                        {roleLabels[hub.membershipRole ?? "MEMBER"] ??
                          "Участник"}
                      </span>
                      {hub.isPrivate ? (
                        <span className="glass-badge">Приватный</span>
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
