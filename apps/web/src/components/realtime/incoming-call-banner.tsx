"use client";

import { PhoneCall, Video } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiClientFetch } from "@/lib/api-client";
import { useRealtime } from "./realtime-provider";

export function IncomingCallBanner() {
  const router = useRouter();
  const { incomingCalls, clearIncomingCall } = useRealtime();
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  if (incomingCalls.length === 0) {
    return null;
  }

  const call = incomingCalls[0];
  const callId = call?.id ?? null;
  const conversationId = call?.dmConversationId ?? null;
  const caller = call?.initiatedBy ?? null;

  if (!call || !callId || !caller) {
    return null;
  }

  const resolvedCallId = callId;

  async function acceptCall() {
    setPendingAction("accept");

    try {
      await apiClientFetch(`/v1/calls/${resolvedCallId}/accept`, {
        method: "POST",
      });
      clearIncomingCall(resolvedCallId);

      if (conversationId) {
        router.push(`/app/messages/${conversationId}`);
        router.refresh();
      }
    } finally {
      setPendingAction(null);
    }
  }

  async function declineCall() {
    setPendingAction("decline");

    try {
      await apiClientFetch(`/v1/calls/${resolvedCallId}/decline`, {
        method: "POST",
      });
      clearIncomingCall(resolvedCallId);
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="border-b border-white/5 bg-[linear-gradient(90deg,rgba(106,168,248,0.16),rgba(17,25,34,0.88)_28%,rgba(17,25,34,0.98))] px-3 py-2.5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="eyebrow-pill">Входящий звонок</span>
            <span className="status-pill">
              {call.mode === "VIDEO" ? (
                <Video size={18} strokeWidth={1.5} />
              ) : (
                <PhoneCall size={18} strokeWidth={1.5} />
              )}
              {call.mode === "VIDEO" ? "Видео" : "Голос"}
            </span>
          </div>
          <p className="mt-1.5 text-sm font-medium text-white">
            {caller.profile.displayName} звонит вам
          </p>
          <p className="mt-1 text-xs text-[var(--text-soft)]">@{caller.username}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => void acceptCall()}
            disabled={pendingAction !== null}
          >
            {pendingAction === "accept" ? "Принимаем..." : "Принять"}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void declineCall()}
            disabled={pendingAction !== null}
          >
            {pendingAction === "decline" ? "Отклоняем..." : "Отклонить"}
          </Button>
        </div>
      </div>
    </div>
  );
}
