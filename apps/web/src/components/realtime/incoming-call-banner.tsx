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
  if (!call) {
    return null;
  }

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
    <div className="border-b border-white/5 bg-[linear-gradient(90deg,rgba(124,140,255,0.18),rgba(124,140,255,0.08))] px-4 py-3 text-white">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="eyebrow-pill">Incoming call</span>
            <span className="status-pill">
              {call.mode === "VIDEO" ? (
                <Video size={18} strokeWidth={1.5} />
              ) : (
                <PhoneCall size={18} strokeWidth={1.5} />
              )}
              {call.mode === "VIDEO" ? "Video" : "Audio"}
            </span>
          </div>
          <p className="mt-2 text-sm font-medium text-white">
            {caller.profile.displayName} is calling you
          </p>
          <p className="mt-1 text-xs text-[var(--text-soft)]">@{caller.username}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => void acceptCall()}
            disabled={pendingAction !== null}
          >
            {pendingAction === "accept" ? "Accepting..." : "Accept"}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void declineCall()}
            disabled={pendingAction !== null}
          >
            {pendingAction === "decline" ? "Declining..." : "Decline"}
          </Button>
        </div>
      </div>
    </div>
  );
}
