"use client";

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

  const incomingCall = incomingCalls[0];
  if (!incomingCall) {
    return null;
  }

  const call = incomingCall;
  const caller = call.initiatedBy;

  async function acceptCall() {
    setPendingAction("accept");

    try {
      await apiClientFetch(`/v1/calls/${call.id}/accept`, {
        method: "POST",
      });
      clearIncomingCall(call.id);

      if (call.dmConversationId) {
        router.push(`/app/messages/${call.dmConversationId}`);
        router.refresh();
      }
    } finally {
      setPendingAction(null);
    }
  }

  async function declineCall() {
    setPendingAction("decline");

    try {
      await apiClientFetch(`/v1/calls/${call.id}/decline`, {
        method: "POST",
      });
      clearIncomingCall(call.id);
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="surface-highlight rounded-[18px] px-4 py-3 text-sm text-white">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="section-kicker text-[var(--accent-strong)]">Входящий звонок</p>
          <p className="mt-1 text-sm font-semibold text-white">
            {caller.profile.displayName} запустил{" "}
            {call.mode === "VIDEO" ? "видео" : "аудио"} call
          </p>
          <p className="mt-0.5 text-xs text-[var(--text-dim)]">@{caller.username}</p>
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
