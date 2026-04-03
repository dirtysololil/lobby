"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AudioLines,
  BellRing,
  Crown,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Waves,
} from "lucide-react";
import {
  directConversationDetailSchema,
  directConversationListResponseSchema,
  directConversationSummaryResponseSchema,
  hubListResponseSchema,
  hubShellResponseSchema,
  type DirectConversationDetail,
  type PublicUser,
} from "@lobby/shared";
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
  const { incomingCalls, latestSignal } = useRealtime();
  const [conversation, setConversation] = useState<
    DirectConversationDetail["conversation"] | null
  >(null);
  const [hubInfo, setHubInfo] = useState<
    ReturnType<typeof hubShellResponseSchema.parse>["hub"] | null
  >(null);
  const [overview, setOverview] = useState<{
    hubs: number;
    conversations: number;
    unread: number;
  } | null>(null);

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

        const [hubsPayload, conversationsPayload] = await Promise.all([
          apiClientFetch("/v1/hubs"),
          apiClientFetch("/v1/direct-messages"),
        ]);

        const hubs = hubListResponseSchema.parse(hubsPayload).items;
        const conversations =
          directConversationListResponseSchema.parse(conversationsPayload).items;

        if (active) {
          setOverview({
            hubs: hubs.length,
            conversations: conversations.length,
            unread: conversations.reduce((sum, item) => sum + item.unreadCount, 0),
          });
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
      <aside className="activity-rail hidden min-h-0 flex-col overflow-hidden rounded-[28px] p-4 2xl:flex 2xl:sticky 2xl:top-3 2xl:h-[calc(100vh-1.5rem)]">
        <div className="surface-highlight rounded-[24px] p-4">
          <p className="section-kicker">Live Detail</p>
          <div className="mt-4 flex items-start gap-3">
            {counterpart ? <UserAvatar user={counterpart} /> : null}
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-semibold text-white">
                {counterpart?.profile.displayName ?? "Диалог"}
              </p>
              <p className="mt-1 text-sm text-[var(--text-dim)]">
                {counterpart ? `@${counterpart.username}` : "Контекст загружен"}
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3 2xl:grid-cols-1">
            <div className="metric-tile rounded-[18px] p-3">
              <p className="section-kicker">Сообщений</p>
              <p className="mt-2 text-xl font-semibold text-white">
                {conversation.messages.length}
              </p>
            </div>
            <div className="metric-tile rounded-[18px] p-3">
              <p className="section-kicker">Retention</p>
              <p className="mt-2 text-sm font-semibold text-white">
                {conversation.retentionMode}
              </p>
            </div>
            <div className="metric-tile rounded-[18px] p-3">
              <p className="section-kicker">Call Layer</p>
              <p className="mt-2 text-sm font-semibold text-white">
                {latestSignal?.call.dmConversationId === route.conversationId
                  ? latestSignal.call.status
                  : "Готов"}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="surface-subtle rounded-[22px] p-4">
            <p className="section-kicker">Channel Rules</p>
            <p className="mt-2 text-sm leading-6 text-[var(--text-dim)]">
              Правила уведомлений и срок жизни истории управляются прямо из
              правого контекстного слоя без разрыва коммуникационного фокуса.
            </p>
          </div>
          {viewerSettings ? (
            <div className="mt-4">
              <ConversationSettings
                notificationSetting={viewerSettings.notificationSetting}
                retentionMode={conversation.retentionMode}
                retentionSeconds={conversation.retentionSeconds}
                disabled={false}
                onSave={saveConversationSettings}
              />
            </div>
          ) : null}
        </div>
      </aside>
    );
  }

  if (route.section === "hubs" && route.hubId && hubInfo) {
    return (
      <aside className="activity-rail hidden min-h-0 flex-col overflow-hidden rounded-[28px] p-4 2xl:flex 2xl:sticky 2xl:top-3 2xl:h-[calc(100vh-1.5rem)]">
        <div className="surface-highlight rounded-[24px] p-4">
          <p className="section-kicker">Community Pulse</p>
          <p className="mt-3 text-lg font-semibold text-white">{hubInfo.name}</p>
          <p className="mt-2 text-sm leading-6 text-[var(--text-dim)]">
            {hubInfo.description ?? "Пространство синхронизировано."}
          </p>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3 2xl:grid-cols-1">
          <div className="metric-tile rounded-[18px] p-3">
            <p className="section-kicker">Участники</p>
            <p className="mt-2 text-xl font-semibold text-white">
              {hubInfo.members.length}
            </p>
          </div>
          <div className="metric-tile rounded-[18px] p-3">
            <p className="section-kicker">Лобби</p>
            <p className="mt-2 text-xl font-semibold text-white">
              {hubInfo.lobbies.length}
            </p>
          </div>
          <div className="metric-tile rounded-[18px] p-3">
            <p className="section-kicker">Mute State</p>
            <p className="mt-2 text-sm font-semibold text-white">
              {hubInfo.isViewerMuted ? "Ограничен" : "Свободен"}
            </p>
          </div>
        </div>

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="surface-subtle rounded-[22px] p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="section-kicker">Members</p>
              <span className="glass-badge">{hubInfo.members.length}</span>
            </div>
            <div className="mt-3 grid gap-2">
              {hubInfo.members.slice(0, 7).map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 rounded-[18px] border border-white/6 bg-white/[0.03] px-3 py-2.5"
                >
                  <UserAvatar user={member.user} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">
                      {member.user.profile.displayName}
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-dim)]">
                      {member.role}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="activity-rail hidden min-h-0 flex-col overflow-hidden rounded-[28px] p-4 2xl:flex 2xl:sticky 2xl:top-3 2xl:h-[calc(100vh-1.5rem)]">
      <div className="surface-highlight rounded-[24px] p-4">
        <p className="section-kicker">Live System</p>
        <p className="mt-3 text-lg font-semibold text-white">
          {latestSignal ? latestSignal.call.status : "Lobby network stable"}
        </p>
        <p className="mt-2 text-sm leading-6 text-[var(--text-dim)]">
          Правый рейл держит live-контекст вторичным: присутствие, сигналы,
          контур контроля и системную готовность без засорения основного фокуса.
        </p>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3 2xl:grid-cols-1">
        <div className="metric-tile rounded-[18px] p-3">
          <p className="section-kicker">Хабы</p>
          <p className="mt-2 text-xl font-semibold text-white">
            {overview?.hubs ?? 0}
          </p>
        </div>
        <div className="metric-tile rounded-[18px] p-3">
          <p className="section-kicker">Диалоги</p>
          <p className="mt-2 text-xl font-semibold text-white">
            {overview?.conversations ?? 0}
          </p>
        </div>
        <div className="metric-tile rounded-[18px] p-3">
          <p className="section-kicker">Unread</p>
          <p className="mt-2 text-xl font-semibold text-white">
            {overview?.unread ?? 0}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        <div className="surface-subtle rounded-[22px] p-4">
          <div className="flex items-center gap-2 text-white">
            <AudioLines className="h-4 w-4 text-[var(--accent)]" />
            Live calls
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--text-dim)]">
            Входящие: {incomingCalls.length}. LiveKit-сессии встроены в shell,
            а не выглядят внешним модулем.
          </p>
        </div>

        <div className="surface-subtle rounded-[22px] p-4">
          <div className="flex items-center gap-2 text-white">
            <UsersRound className="h-4 w-4 text-[var(--accent)]" />
            Community
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--text-dim)]">
            Хабы, настройки и модерация живут в одной пространственной системе
            и не выпадают в admin-dashboard паттерны.
          </p>
        </div>

        <div className="surface-subtle rounded-[22px] p-4">
          <div className="flex items-center gap-2 text-white">
            {viewer.role === "MEMBER" ? (
              <Waves className="h-4 w-4 text-[var(--accent)]" />
            ) : (
              <Crown className="h-4 w-4 text-[var(--accent-warm)]" />
            )}
            Account role
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--text-dim)]">
            {viewer.role === "MEMBER"
              ? "Пользовательское пространство сфокусировано на общении и присутствии."
              : "Для роли управления открыт модуль контроля и приватной модерации."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/app/settings/profile" className="glass-badge">
              <BellRing className="h-3 w-3" />
              Preferences
            </Link>
            {viewer.role !== "MEMBER" ? (
              <Link href="/app/admin" className="glass-badge">
                <ShieldCheck className="h-3 w-3" />
                Control
              </Link>
            ) : null}
            <span className="glass-badge">
              <Sparkles className="h-3 w-3" />
              One product
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
