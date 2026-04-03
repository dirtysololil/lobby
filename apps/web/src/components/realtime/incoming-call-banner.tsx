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
    <div className="rounded-[28px] border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm text-emerald-50 shadow-[var(--shadow)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-emerald-100/80">Входящий звонок</p>
          <p className="mt-2 text-base font-medium text-white">
            {caller.profile.displayName} начал {call.mode === "VIDEO" ? "видео" : "аудио"} call
          </p>
          <p className="mt-1 text-sm text-emerald-50/80">@{caller.username}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void acceptCall()} disabled={pendingAction !== null}>
            {pendingAction === "accept" ? "Принимаем..." : "Принять"}
          </Button>
          <Button variant="secondary" onClick={() => void declineCall()} disabled={pendingAction !== null}>
            {pendingAction === "decline" ? "Отклоняем..." : "Отклонить"}
          </Button>
        </div>
      </div>
    </div>
  );
}
