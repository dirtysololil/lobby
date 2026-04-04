"use client";

import {
  directConversationDetailSchema,
  directConversationSummaryResponseSchema,
  hubShellResponseSchema,
  type DirectConversationDetail,
  type PublicUser,
} from "@lobby/shared";
import { BellRing, LockKeyhole, PhoneCall, UsersRound, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { apiClientFetch } from "@/lib/api-client";
import { parseAppPath } from "@/lib/app-shell";
import { UserAvatar } from "@/components/ui/user-avatar";
import { ConversationSettings } from "@/components/messages/conversation-settings";
import { useRealtime } from "@/components/realtime/realtime-provider";
import { callStatusLabels, dmNotificationLabels, dmRetentionLabels } from "@/lib/ui-labels";
import { cn } from "@/lib/utils";

interface AppActivityRailProps {
  viewer: PublicUser;
  open: boolean;
  onClose: () => void;
  mode: "overlay" | "docked";
}

const iconProps = { size: 18, strokeWidth: 1.5 } as const;

function formatRole(role: string | null | undefined) {
  switch (role) {
    case "OWNER":
      return "Владелец";
    case "ADMIN":
      return "Админ";
    case "MEMBER":
      return "Участник";
    case "GUEST":
      return "Гость";
    default:
      return role ?? "Участник";
  }
}

export function AppActivityRail({
  viewer,
  open,
  onClose,
  mode,
}: AppActivityRailProps) {
  const pathname = usePathname();
  const route = parseAppPath(pathname ?? "");
  const { latestSignal } = useRealtime();
  const [conversation, setConversation] = useState<
    DirectConversationDetail["conversation"] | null
  >(null);
  const [hubInfo, setHubInfo] = useState<
    ReturnType<typeof hubShellResponseSchema.parse>["hub"] | null
  >(null);
  const [isLoading, setIsLoading] = useState(false);

  const available =
    (route.section === "messages" && Boolean(route.conversationId)) ||
    (route.section === "hubs" && Boolean(route.hubId));

  useEffect(() => {
    if (!open || mode !== "overlay") {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mode, onClose, open]);

  useEffect(() => {
    if (!open || !available) {
      return;
    }

    let active = true;
    setIsLoading(true);

    void (async () => {
      try {
        if (route.section === "messages" && route.conversationId) {
          const payload = await apiClientFetch(
            `/v1/direct-messages/${route.conversationId}`,
          );

          if (active) {
            setConversation(directConversationDetailSchema.parse(payload).conversation);
            setHubInfo(null);
          }
          return;
        }

        if (route.section === "hubs" && route.hubId) {
          const payload = await apiClientFetch(`/v1/hubs/${route.hubId}`);

          if (active) {
            setHubInfo(hubShellResponseSchema.parse(payload).hub);
            setConversation(null);
          }
        }
      } catch {
        if (active) {
          setConversation(null);
          setHubInfo(null);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [available, open, route.conversationId, route.hubId, route.section]);

  async function saveConversationSettings(payload: {
    notificationSetting: "ALL" | "MENTIONS_ONLY" | "MUTED" | "OFF";
    retentionMode: "OFF" | "H24" | "D7" | "D30" | "CUSTOM";
    customHours: number | null;
  }) {
    if (!route.conversationId) {
      return;
    }

    const response = await apiClientFetch(
      `/v1/direct-messages/${route.conversationId}/settings`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    );

    directConversationSummaryResponseSchema.parse(response);

    const nextConversation = await apiClientFetch(
      `/v1/direct-messages/${route.conversationId}`,
    );

    setConversation(directConversationDetailSchema.parse(nextConversation).conversation);
  }

  if (!open || !available) {
    return null;
  }

  const panel = (
    <aside
      className={cn(
        "activity-rail flex w-64 min-w-64 flex-col border-l border-white/5 bg-[#121214]",
        mode === "overlay"
          ? "absolute inset-y-0 right-0 z-50 h-full"
          : "h-full",
      )}
      onClick={(event) => {
        if (mode === "overlay") {
          event.stopPropagation();
        }
      }}
    >
      <div className="flex h-12 items-center justify-between border-b border-white/5 px-3">
        <div>
          <p className="text-xs text-zinc-500">
            {route.section === "messages" ? "Диалог" : "Хаб"}
          </p>
          <p className="text-sm font-medium text-white">
            {route.section === "messages" ? "Детали" : "Контекст"}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/5 bg-white/5 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Закрыть панель"
        >
          <X {...iconProps} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="px-3 py-6 text-center text-sm text-zinc-500">
            Загружаем детали...
          </div>
        ) : null}

        {route.section === "messages" && route.conversationId && conversation ? (
          <div>
            {(() => {
              const counterpart = conversation.participants.find(
                (participant) => participant.user.id !== viewer.id,
              )?.user;
              const viewerSettings = conversation.participants.find(
                (participant) => participant.user.id === viewer.id,
              );

              return (
                <>
                  <div className="border-b border-white/5 px-3 py-3">
                    <div className="flex items-center gap-3">
                      {counterpart ? <UserAvatar user={counterpart} size="md" /> : null}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">
                          {counterpart?.profile.displayName ?? "Диалог"}
                        </p>
                        <p className="truncate text-xs text-zinc-500">
                          {counterpart ? `@${counterpart.username}` : "Личная ветка"}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <span className="status-pill">
                        <BellRing {...iconProps} />
                        {dmNotificationLabels[viewerSettings?.notificationSetting ?? "ALL"]}
                      </span>
                      <span className="status-pill">
                        <PhoneCall {...iconProps} />
                        {latestSignal?.call.dmConversationId === route.conversationId
                          ? callStatusLabels[latestSignal.call.status]
                          : "Звонок готов"}
                      </span>
                      {conversation.retentionMode !== "OFF" ? (
                        <span className="status-pill">
                          <LockKeyhole {...iconProps} />
                          {dmRetentionLabels[conversation.retentionMode]}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="px-3 py-3">
                    {viewerSettings ? (
                      <ConversationSettings
                        notificationSetting={viewerSettings.notificationSetting}
                        retentionMode={conversation.retentionMode}
                        retentionSeconds={conversation.retentionSeconds}
                        disabled={false}
                        onSave={saveConversationSettings}
                      />
                    ) : null}
                  </div>
                </>
              );
            })()}
          </div>
        ) : null}

        {route.section === "hubs" && route.hubId && hubInfo ? (
          <div>
            <div className="border-b border-white/5 px-3 py-3">
              <p className="truncate text-sm font-medium text-white">{hubInfo.name}</p>
              <p className="mt-1 text-sm text-zinc-400">
                {hubInfo.description ?? "Общее пространство"}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="status-pill">
                  <UsersRound {...iconProps} />
                  {hubInfo.members.length} участников
                </span>
                <span className="status-pill">{formatRole(hubInfo.membershipRole)}</span>
              </div>
            </div>

            <div>
              {hubInfo.members.slice(0, 12).map((member) => (
                <div
                  key={member.id}
                  className="flex min-h-11 items-center gap-3 border-b border-white/5 px-3 text-zinc-400 transition-colors hover:bg-white/5"
                >
                  <UserAvatar user={member.user} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-white">
                      {member.user.profile.displayName}
                    </p>
                    <p className="truncate text-xs text-zinc-500">
                      @{member.user.username} - {formatRole(member.role)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {!isLoading &&
        ((route.section === "messages" && !conversation) ||
          (route.section === "hubs" && !hubInfo)) ? (
          <div className="px-3 py-6 text-center text-sm text-zinc-500">
            Здесь пока нечего показывать.
          </div>
        ) : null}
      </div>
    </aside>
  );

  if (mode === "overlay") {
    return (
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} role="presentation">
        {panel}
      </div>
    );
  }

  return panel;
}
