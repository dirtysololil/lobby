"use client";

import {
  hubListResponseSchema,
  hubSummarySchema,
  viewerHubInvitesResponseSchema,
  type HubInvite,
  type HubSummary,
} from "@lobby/shared";
import { LockKeyhole, Plus, Waves } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AppMobileTopNav } from "@/components/app/app-mobile-top-nav";
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
  OWNER: "Владелец",
  ADMIN: "Администратор",
  MODERATOR: "Модератор",
  MEMBER: "Участник",
};

const fieldClassName =
  "h-11 rounded-[14px] border-white/8 bg-white/[0.03] px-3.5 text-sm text-white shadow-none hover:border-[var(--border-strong)] focus:bg-white/[0.05]";

const textareaClassName =
  "field-textarea min-h-[108px] rounded-[16px] border-white/8 bg-white/[0.03] px-3.5 py-3 text-sm leading-6 text-white shadow-none hover:border-[var(--border-strong)] focus:bg-white/[0.05]";

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

function HubsCreatePanel({
  description,
  errorMessage,
  isPrivate,
  isSubmitting,
  name,
  onSubmit,
  setDescription,
  setIsPrivate,
  setName,
  setSlug,
  slug,
}: {
  description: string;
  errorMessage: string | null;
  isPrivate: boolean;
  isSubmitting: boolean;
  name: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  setDescription: (value: string) => void;
  setIsPrivate: (value: boolean) => void;
  setName: (value: string) => void;
  setSlug: (value: string) => void;
  slug: string;
}) {
  return (
    <aside
      id="create-hub-form"
      className="order-first rounded-[24px] border border-white/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent_18%),rgba(16,24,36,0.76)] p-4 shadow-[0_18px_36px_rgba(4,10,18,0.18)] xl:order-last xl:min-h-0 xl:overflow-y-auto"
    >
      <div className="flex items-start gap-3">
        <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] border border-[#4a84ff]/22 bg-[#14233a] text-white">
          <Plus size={18} strokeWidth={1.8} />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <CompactListMeta className="border-white/6 bg-white/[0.04] text-[#9ca9bb]">
              Новый хаб
            </CompactListMeta>
          </div>
          <h3 className="mt-2 text-[18px] font-semibold tracking-[-0.03em] text-white">
            Создать пространство
          </h3>
          <p className="mt-1 text-sm leading-6 text-[#8d98aa]">
            Короткое имя, понятный slug и сразу в общение.
          </p>
        </div>
      </div>

      {errorMessage ? (
        <div className="mt-4 rounded-[18px] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          {errorMessage}
        </div>
      ) : null}

      <form className="mt-4 grid gap-3" onSubmit={onSubmit}>
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Название хаба"
          className={fieldClassName}
        />
        <Input
          value={slug}
          onChange={(event) => setSlug(event.target.value)}
          placeholder="slug"
          className={fieldClassName}
        />
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Короткое описание"
          className={textareaClassName}
        />
        <label className="field-checkbox rounded-[14px] border border-white/6 bg-white/[0.03] px-3.5 py-3 text-sm text-white">
          <input
            type="checkbox"
            checked={isPrivate}
            onChange={(event) => setIsPrivate(event.target.checked)}
          />
          Приватный хаб
        </label>
        <Button type="submit" disabled={isSubmitting} className="h-11 rounded-[14px]">
          {isSubmitting ? "Создаём..." : "Создать хаб"}
        </Button>
      </form>
    </aside>
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
      setErrorMessage(error instanceof Error ? error.message : "Не удалось загрузить хабы.");
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
      setErrorMessage(error instanceof Error ? error.message : "Не удалось создать хаб.");
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
        error instanceof Error ? error.message : "Не удалось обработать инвайт.",
      );
    }
  }

  return (
    <section className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[#0d151f] md:bg-[linear-gradient(180deg,rgba(255,255,255,0.012),transparent_14%),#0f1721]">
      <div className="absolute inset-0 hidden bg-[radial-gradient(circle_at_50%_15%,rgba(69,110,185,0.14),transparent_0%,transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.01),transparent_18%)] md:block" />

      <div className="relative flex h-full min-h-0 flex-col">
        <div className="border-b border-white/5 px-4 pb-3 pt-5 md:px-5 md:pb-4 md:pt-5">
          <div className="md:hidden">
            <AppMobileTopNav active="hubs" />
          </div>

          <div className="mt-4 flex flex-col gap-4 md:mt-0 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <CompactListMeta className="border-white/6 bg-white/[0.04] text-[#9ca9bb]">
                  Хабы
                </CompactListMeta>
                <CompactListMeta className="border-white/6 bg-white/[0.04] text-[#9ca9bb]">
                  {hubs.length} пространств
                </CompactListMeta>
                {invites.length > 0 ? (
                  <CompactListMeta className="border-white/6 bg-white/[0.04] text-[#9ca9bb]">
                    {invites.length} инвайтов
                  </CompactListMeta>
                ) : null}
              </div>
              <h2 className="mt-3 text-[26px] font-semibold tracking-[-0.04em] text-white">
                Пространства
              </h2>
              <p className="mt-1 text-sm text-[#8d98aa]">
                Собирайте публичные и приватные хабы, принимайте инвайты и держите
                все сервисные пространства под рукой.
              </p>
            </div>

            <a
              href="#create-hub-form"
              className="hidden min-h-11 items-center justify-center rounded-[14px] border border-[#4a84ff]/24 bg-[#14233a] px-4 text-sm font-medium text-white transition-colors hover:bg-[#18304f] md:inline-flex"
            >
              Создать хаб
            </a>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto grid min-h-full w-full max-w-[1100px] gap-3 px-4 py-3 md:px-5 md:py-5 xl:grid-cols-[minmax(0,1fr)_320px]">
            <HubsCreatePanel
              description={description}
              errorMessage={null}
              isPrivate={isPrivate}
              isSubmitting={isSubmitting}
              name={name}
              onSubmit={handleCreateHub}
              setDescription={setDescription}
              setIsPrivate={setIsPrivate}
              setName={setName}
              setSlug={setSlug}
              slug={slug}
            />

            <div className="grid gap-3">
              {errorMessage ? (
                <div className="rounded-[18px] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                  {errorMessage}
                </div>
              ) : null}

              {invites.length > 0 ? (
                <section className="overflow-hidden rounded-[24px] border border-white/6 bg-white/[0.02]">
                  <CompactListHeader className="px-4 py-3">
                    <span>Инвайты</span>
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
                            {invite.hub.isPrivate ? (
                              <CompactListCount>Приватный</CompactListCount>
                            ) : null}
                          </div>
                          <p className="mt-1 truncate text-xs text-[var(--text-dim)]">
                            Пригласил {invite.invitedBy.profile.displayName}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          <Button
                            size="sm"
                            onClick={() => void handleInviteAction(invite.id, "accept")}
                            className="h-8 px-2.5"
                          >
                            Принять
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => void handleInviteAction(invite.id, "decline")}
                            className="h-8 px-2.5"
                          >
                            Отклонить
                          </Button>
                        </div>
                      </CompactListRow>
                    ))}
                  </CompactList>
                </section>
              ) : null}

              <section className="overflow-hidden rounded-[24px] border border-white/6 bg-white/[0.02]">
                <CompactListHeader className="px-4 py-3">
                  <span>Ваши хабы</span>
                  <CompactListCount>{hubs.length}</CompactListCount>
                </CompactListHeader>
                {hubs.length === 0 ? (
                  <EmptyView
                    title="Хабов пока нет"
                    description="Создайте пространство или примите инвайт, чтобы начать."
                  />
                ) : (
                  <CompactList>
                    {hubs.map((hub) => (
                      <CompactListLink
                        key={hub.id}
                        href={`/app/hubs/${hub.id}`}
                        className="gap-3"
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-white/6 bg-white/[0.04] text-[11px] font-semibold text-white">
                          {hub.name.slice(0, 2).toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-medium leading-tight text-white">
                              {hub.name}
                            </p>
                            <CompactListCount>
                              {roleLabels[hub.membershipRole ?? "MEMBER"] ?? "Участник"}
                            </CompactListCount>
                            {hub.isPrivate ? (
                              <span className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]">
                                <LockKeyhole className="h-[16px] w-[16px]" />
                                Приватный
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 truncate text-xs leading-tight text-[var(--text-dim)]">
                            {hub.description ?? "Описания пока нет."}
                          </p>
                        </div>
                      </CompactListLink>
                    ))}
                  </CompactList>
                )}
              </section>

              <div className="pb-2 pt-1 text-center text-[12px] text-[#7b8697]">
                {hubs.length} пространств
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
