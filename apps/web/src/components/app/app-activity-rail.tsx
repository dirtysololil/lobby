"use client";

import {
  directConversationDetailSchema,
  directConversationSummaryResponseSchema,
  hubShellResponseSchema,
  type DirectConversationDetail,
  type PublicUser,
} from "@lobby/shared";
import { BellRing, LockKeyhole, PhoneCall, UsersRound } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { apiClientFetch } from "@/lib/api-client";
import { parseAppPath } from "@/lib/app-shell";
import { UserAvatar } from "@/components/ui/user-avatar";
import { ConversationSettings } from "@/components/messages/conversation-settings";
import { useRealtime } from "@/components/realtime/realtime-provider";

interface AppActivityRailProps {
  viewer: PublicUser;
}

export function AppActivityRail({ viewer }: AppActivityRailProps) {
  const pathname = usePathname();
  const route = parseAppPath(pathname);
  const { latestSignal } = useRealtime();
  const [conversation, setConversation] = useState<
    DirectConversationDetail["conversation"] | null
  >(null);
  const [hubInfo, setHubInfo] = useState<
    ReturnType<typeof hubShellResponseSchema.parse>["hub"] | null
  >(null);

  useEffect(() => {
    let active = true;

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
          return;
        }

        if (active) {
          setConversation(null);
          setHubInfo(null);
        }
      } catch {
        if (active) {
          setConversation(null);
          setHubInfo(null);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [route.conversationId, route.hubId, route.section]);

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

  if (route.section === "messages" && route.conversationId && conversation) {
    const counterpart = conversation.participants.find(
      (participant) => participant.user.id !== viewer.id,
    )?.user;
    const viewerSettings = conversation.participants.find(
      (participant) => participant.user.id === viewer.id,
    );

    return (
      <aside className="activity-rail hidden min-h-0 w-[296px] shrink-0 flex-col overflow-hidden rounded-[20px] p-2.5 2xl:flex 2xl:sticky 2xl:top-3 2xl:h-[calc(100vh-1.5rem)]">
        <div className="surface-highlight rounded-[16px] p-3">
          <div className="flex items-center gap-3">
            {counterpart ? <UserAvatar user={counterpart} size="md" /> : null}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">
                {counterpart?.profile.displayName ?? "Conversation"}
              </p>
              <p className="truncate text-xs text-[var(--text-dim)]">
                {counterpart ? `@${counterpart.username}` : "Private thread"}
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="status-pill">
              <BellRing className="h-3.5 w-3.5 text-[var(--accent)]" />
              {viewerSettings?.notificationSetting ?? "ALL"}
            </span>
            <span className="status-pill">
              <PhoneCall className="h-3.5 w-3.5 text-[var(--accent)]" />
              {latestSignal?.call.dmConversationId === route.conversationId
                ? latestSignal.call.status
                : "Call ready"}
            </span>
            {conversation.retentionMode !== "OFF" ? (
              <span className="status-pill">
                <LockKeyhole className="h-3.5 w-3.5 text-[var(--accent)]" />
                {conversation.retentionMode}
              </span>
            ) : null}
          </div>
        </div>

        <div className="mt-2.5 min-h-0 flex-1 overflow-y-auto pr-1">
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
      </aside>
    );
  }

  if (route.section === "hubs" && route.hubId && hubInfo) {
    return (
      <aside className="activity-rail hidden min-h-0 w-[296px] shrink-0 flex-col overflow-hidden rounded-[20px] p-2.5 2xl:flex 2xl:sticky 2xl:top-3 2xl:h-[calc(100vh-1.5rem)]">
        <div className="surface-highlight rounded-[16px] p-3">
          <p className="truncate text-sm font-semibold text-white">{hubInfo.name}</p>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--text-dim)]">
            {hubInfo.description ?? "Hub members"}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="status-pill">
              <UsersRound className="h-3.5 w-3.5 text-[var(--accent)]" />
              {hubInfo.members.length} members
            </span>
            <span className="status-pill">{hubInfo.membershipRole ?? "Guest"}</span>
          </div>
        </div>

        <div className="mt-2.5 min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="grid gap-2">
            {hubInfo.members.slice(0, 10).map((member) => (
              <div
                key={member.id}
                className="list-row flex items-center gap-3 rounded-[16px] px-3 py-2.5"
              >
                <UserAvatar user={member.user} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">
                    {member.user.profile.displayName}
                  </p>
                  <p className="truncate text-xs text-[var(--text-dim)]">
                    @{member.user.username} · {member.role}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>
    );
  }

  return null;
}
