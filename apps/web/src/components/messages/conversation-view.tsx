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
      <div className="empty-state-minimal">
        <p className="text-sm text-rose-200">{errorMessage}</p>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="empty-state-minimal">
        <p className="text-sm text-[var(--text-muted)]">Loading conversation...</p>
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
    <div className="flex min-h-full flex-col">
      <section className="flex min-h-0 flex-1 flex-col">
        <div className="flex h-12 items-center justify-between gap-3 border-b border-[var(--border)] px-3">
          <div className="flex min-w-0 items-center gap-3">
            {counterpart ? <UserAvatar user={counterpart} size="sm" /> : null}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-medium text-white">
                  {counterpart?.profile.displayName ?? "Conversation"}
                </p>
                <span className="status-pill">
                  <UserRound className="h-[18px] w-[18px] text-[var(--accent)]" />
                  DM
                </span>
                {conversation.retentionMode !== "OFF" ? (
                  <span className="status-pill">
                    <Clock3 className="h-[18px] w-[18px] text-[var(--accent)]" />
                    {conversation.retentionMode}
                  </span>
                ) : null}
                {isBlocked ? (
                  <span className="status-pill">
                    <ShieldAlert className="h-[18px] w-[18px] text-[var(--danger)]" />
                    Restricted
                  </span>
                ) : null}
              </div>
              <p className="truncate text-xs text-[var(--text-dim)]">
                {counterpart ? `@${counterpart.username}` : "Private thread"}
              </p>
            </div>
          </div>

          <Link href="/app/messages">
            <Button size="sm" variant="ghost">
              <ArrowLeft className="h-[18px] w-[18px]" />
              Back
            </Button>
          </Link>
        </div>

        {isBlocked ? (
          <div className="border-b border-amber-300/20 bg-amber-300/10 px-3 py-2 text-sm text-amber-100">
            Messaging and calling are unavailable in this conversation.
          </div>
        ) : null}

        <div className="border-b border-[var(--border-soft)] px-3 py-2">
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

        <div className="border-t border-[var(--border)] px-3 py-2">
          <MessageComposer disabled={isBlocked} onSend={sendMessage} />
        </div>
      </section>

      <div className="border-t border-[var(--border)] px-3 py-3 2xl:hidden">
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
