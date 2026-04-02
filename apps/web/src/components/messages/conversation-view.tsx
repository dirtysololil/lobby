"use client";

import Link from "next/link";
import {
  directConversationDetailSchema,
  directConversationSummaryResponseSchema,
  directMessageResponseSchema,
  type DirectConversationDetail,
} from "@lobby/shared";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClientFetch } from "@/lib/api-client";
import { DmCallPanel } from "@/components/calls/dm-call-panel";
import { ConversationSettings } from "./conversation-settings";
import { MessageComposer } from "./message-composer";
import { MessageThread } from "./message-thread";

interface ConversationViewProps {
  conversationId: string;
  viewerId: string;
}

export function ConversationView({ conversationId, viewerId }: ConversationViewProps) {
  const [conversation, setConversation] = useState<DirectConversationDetail["conversation"] | null>(null);
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
      setErrorMessage(error instanceof Error ? error.message : "Unable to load conversation");
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
      const payload = await apiClientFetch(`/v1/direct-messages/${conversationId}/messages/${messageId}`, {
        method: "DELETE",
      });

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
    const response = await apiClientFetch(`/v1/direct-messages/${conversationId}/settings`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });

    directConversationSummaryResponseSchema.parse(response);
    await loadConversation();
  }

  if (errorMessage) {
    return (
      <div className="rounded-3xl border border-rose-400/20 bg-rose-400/10 px-5 py-4 text-sm text-rose-100">
        {errorMessage}
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-5 text-sm text-slate-400">
        Loading conversation...
      </div>
    );
  }

  const counterpart = conversation.participants.find((participant) => participant.user.id !== viewerId)?.user;
  const isBlocked = conversation.isBlockedByViewer || conversation.hasBlockedViewer;

  return (
    <div className="grid gap-6 lg:grid-cols-[0.72fr_0.28fr]">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>{counterpart?.profile.displayName ?? "Direct conversation"}</CardTitle>
              <CardDescription>
                {counterpart ? `@${counterpart.username}` : "Participant not found"}
              </CardDescription>
            </div>
            <Link href="/app/messages">
              <Button variant="secondary">Back to inbox</Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {isBlocked ? (
            <div className="rounded-3xl border border-amber-300/20 bg-amber-300/10 px-5 py-4 text-sm text-amber-50">
              Messaging is disabled because one of the users blocked the other.
            </div>
          ) : null}

          <DmCallPanel conversationId={conversationId} viewerId={viewerId} isBlocked={isBlocked} />

          <MessageThread
            viewerId={viewerId}
            conversation={conversation}
            isDeleting={isDeleting}
            onDelete={deleteMessage}
          />
          <MessageComposer disabled={isBlocked} onSend={sendMessage} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>DM settings</CardTitle>
          <CardDescription>Notification mode and retention are stored per direct conversation.</CardDescription>
        </CardHeader>
        <CardContent>
          <ConversationSettings
            notificationSetting={
              conversation.participants.find((participant) => participant.user.id === viewerId)?.notificationSetting ??
              "ALL"
            }
            retentionMode={conversation.retentionMode}
            retentionSeconds={conversation.retentionSeconds}
            disabled={false}
            onSave={saveSettings}
          />
        </CardContent>
      </Card>
    </div>
  );
}
