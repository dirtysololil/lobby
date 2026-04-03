"use client";

import Link from "next/link";
import { ArrowLeft, Clock3, ShieldAlert, UserRound } from "lucide-react";
import {
  directConversationDetailSchema,
  directConversationSummaryResponseSchema,
  directMessageResponseSchema,
  type DirectConversationDetail,
} from "@lobby/shared";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { apiClientFetch } from "@/lib/api-client";
import { DmCallPanel } from "@/components/calls/dm-call-panel";
import { ConversationSettings } from "./conversation-settings";
import { MessageComposer } from "./message-composer";
import { MessageThread } from "./message-thread";

interface ConversationViewProps {
  conversationId: string;
  viewerId: string;
}

const iconProps = { size: 18, strokeWidth: 1.5 } as const;

export function ConversationView({
  conversationId,
  viewerId,
}: ConversationViewProps) {
  const [conversation, setConversation] = useState<
    DirectConversationDetail["conversation"] | null
  >(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const loadConversation = useCallback(async () => {
    try {
      const payload = await apiClientFetch(`/v1/direct-messages/${conversationId}`);
      const parsed = directConversationDetailSchema.parse(payload);
      setConversation(parsed.conversation);
      setErrorMessage(null);
      await apiClientFetch(`/v1/direct-messages/${conversationId}/read`, {
        method: "POST",
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to load conversation.",
      );
    }
  }, [conversationId]);

  useEffect(() => {
    void loadConversation();
  }, [loadConversation]);

  async function sendMessage(content: string) {
    await apiClientFetch(`/v1/direct-messages/${conversationId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content }),
    });
    await loadConversation();
  }

  async function deleteMessage(messageId: string) {
    setIsDeleting(messageId);

    try {
      const payload = await apiClientFetch(
        `/v1/direct-messages/${conversationId}/messages/${messageId}`,
        { method: "DELETE" },
      );
      directMessageResponseSchema.parse(payload);
      await loadConversation();
    } finally {
      setIsDeleting(null);
    }
  }

  async function saveSettings(payload: {
    notificationSetting: "ALL" | "MENTIONS_ONLY" | "MUTED" | "OFF";
    retentionMode: "OFF" | "H24" | "D7" | "D30" | "CUSTOM";
    customHours: number | null;
  }) {
    const response = await apiClientFetch(
      `/v1/direct-messages/${conversationId}/settings`,
      { method: "PATCH", body: JSON.stringify(payload) },
    );
    directConversationSummaryResponseSchema.parse(response);
    await loadConversation();
  }

  if (errorMessage) {
    return (
      <div className="empty-state-minimal bg-[#09090b] text-zinc-500">
        <ShieldAlert {...iconProps} />
        <p className="text-sm text-rose-200">{errorMessage}</p>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="empty-state-minimal bg-[#09090b] text-zinc-500">
        <UserRound {...iconProps} />
        <p className="text-sm">Loading conversation...</p>
      </div>
    );
  }

  const counterpart = conversation.participants.find(
    (participant) => participant.user.id !== viewerId,
  )?.user;
  const isBlocked =
    conversation.isBlockedByViewer || conversation.hasBlockedViewer;
  const viewerSettings =
    conversation.participants.find((participant) => participant.user.id === viewerId)
      ?.notificationSetting ?? "ALL";

  return (
    <div className="flex min-h-full flex-col bg-[#09090b]">
      <section className="flex min-h-0 flex-1 flex-col">
        <div className="sticky top-0 z-10 flex h-12 items-center justify-between gap-3 border-b border-white/5 bg-[rgba(9,9,11,0.82)] px-4 backdrop-blur-md">
          <div className="flex min-w-0 items-center gap-3">
            {counterpart ? <UserAvatar user={counterpart} size="sm" /> : null}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-medium tracking-tight text-white">
                  {counterpart?.profile.displayName ?? "Conversation"}
                </p>
                <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                  <UserRound {...iconProps} />
                  DM
                </span>
                {conversation.retentionMode !== "OFF" ? (
                  <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                    <Clock3 {...iconProps} />
                    {conversation.retentionMode}
                  </span>
                ) : null}
                {isBlocked ? (
                  <span className="inline-flex items-center gap-1 text-xs text-rose-300">
                    <ShieldAlert {...iconProps} />
                    Restricted
                  </span>
                ) : null}
              </div>
              <p className="truncate text-xs text-zinc-500">
                {counterpart ? `@${counterpart.username}` : "Private thread"}
              </p>
            </div>
          </div>

          <Link href="/app/messages">
            <Button size="sm" variant="ghost">
              <ArrowLeft {...iconProps} />
              Back
            </Button>
          </Link>
        </div>

        {isBlocked ? (
          <div className="border-b border-white/5 px-4 py-2 text-sm text-zinc-400">
            Messaging and calling are unavailable in this conversation.
          </div>
        ) : null}

        <div className="border-b border-white/5 px-4 py-2">
          <DmCallPanel
            conversationId={conversationId}
            viewerId={viewerId}
            isBlocked={isBlocked}
          />
        </div>

        <div className="min-h-0 flex-1">
          <MessageThread
            viewerId={viewerId}
            conversation={conversation}
            isDeleting={isDeleting}
            onDelete={deleteMessage}
          />
        </div>

        <div className="border-t border-white/5 bg-[rgba(9,9,11,0.88)] px-4 py-3 backdrop-blur-md">
          <MessageComposer disabled={isBlocked} onSend={sendMessage} />
        </div>
      </section>

      <div className="border-t border-white/5 px-4 py-3 2xl:hidden">
        <ConversationSettings
          notificationSetting={viewerSettings}
          retentionMode={conversation.retentionMode}
          retentionSeconds={conversation.retentionSeconds}
          disabled={false}
          onSave={saveSettings}
        />
      </div>
    </div>
  );
}
