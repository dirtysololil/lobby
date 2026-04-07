"use client";

import { ArrowLeft, BellRing, Clock3, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PresenceIndicator } from "@/components/ui/presence-indicator";
import { UserAvatar } from "@/components/ui/user-avatar";
import { MessageComposer } from "@/components/messages/message-composer";
import {
  MessageThread,
  type ThreadMessageItem,
} from "@/components/messages/message-thread";
import { PreviewShell } from "../_preview-shell";
import {
  previewLeo,
  previewMira,
  previewNina,
  previewViewer,
} from "../_mock-data";

const activeContact = previewMira;

const messages: ThreadMessageItem[] = [
  {
    id: "msg-1",
    conversationId: "conv-1",
    type: "TEXT",
    author: activeContact,
    content: "Pushed the tightened DM scene. The thread feels a lot denser now.",
    sticker: null,
    gif: null,
    isDeleted: false,
    canDelete: false,
    deleteExpiresAt: null,
    clientNonce: null,
    createdAt: new Date(Date.now() - 1000 * 60 * 32).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 32).toISOString(),
  },
  {
    id: "msg-2",
    conversationId: "conv-1",
    type: "TEXT",
    author: activeContact,
    content: "The new call strip reads much more like a communication product.",
    sticker: null,
    gif: null,
    isDeleted: false,
    canDelete: false,
    deleteExpiresAt: null,
    clientNonce: null,
    createdAt: new Date(Date.now() - 1000 * 60 * 31).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 31).toISOString(),
  },
  {
    id: "msg-3",
    conversationId: "conv-1",
    type: "TEXT",
    author: previewViewer,
    content:
      "Good. I also tightened the rails and removed the leftover cheap accent tone.",
    sticker: null,
    gif: null,
    isDeleted: false,
    canDelete: true,
    deleteExpiresAt: new Date(Date.now() + 1000 * 60 * 24).toISOString(),
    clientNonce: null,
    createdAt: new Date(Date.now() - 1000 * 60 * 28).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 28).toISOString(),
  },
  {
    id: "msg-4",
    conversationId: "conv-1",
    type: "TEXT",
    author: previewViewer,
    content: "Need a final screenshot set once the build stays green.",
    sticker: null,
    gif: null,
    isDeleted: false,
    canDelete: true,
    deleteExpiresAt: new Date(Date.now() + 1000 * 60 * 18).toISOString(),
    clientNonce: null,
    createdAt: new Date(Date.now() - 1000 * 60 * 27).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 27).toISOString(),
  },
  {
    id: "msg-5",
    conversationId: "conv-1",
    type: "TEXT",
    author: activeContact,
    content:
      "Sending one more pass on the hub and settings hierarchy now.",
    sticker: null,
    gif: null,
    isDeleted: false,
    canDelete: false,
    deleteExpiresAt: null,
    clientNonce: null,
    createdAt: new Date(Date.now() - 1000 * 60 * 7).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 7).toISOString(),
  },
  {
    id: "msg-6",
    conversationId: "conv-1",
    type: "TEXT",
    author: previewViewer,
    content:
      "Perfect. Keep the thread compact and the action states obvious.",
    sticker: null,
    gif: null,
    isDeleted: false,
    canDelete: true,
    deleteExpiresAt: new Date(Date.now() + 1000 * 60 * 45).toISOString(),
    clientNonce: "nonce-6",
    createdAt: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
    localState: "sending",
  },
];

const lastReadAt = messages[3]!.createdAt;

export default function PreviewDmThreadPage() {
  return (
    <PreviewShell
      viewer={previewViewer}
      sectionLabel="Conversations"
      rows={[
        {
          id: "r1",
          user: activeContact,
          label: activeContact.profile.displayName,
          detail: "The thread feels a lot denser now.",
          active: true,
          meta: (
            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--accent)] px-1.5 text-[11px] text-white">
              2
            </span>
          ),
        },
        {
          id: "r2",
          user: previewLeo,
          label: previewLeo.profile.displayName,
          detail: "Ready when you are.",
        },
        {
          id: "r3",
          user: previewNina,
          label: previewNina.profile.displayName,
          detail: "Status board updated.",
        },
      ]}
    >
      <div className="flex min-h-screen flex-col">
        <div className="sticky top-[57px] z-10 flex h-14 items-center justify-between gap-3 border-b border-white/5 bg-[rgba(11,16,24,0.86)] px-4 backdrop-blur-xl">
          <div className="flex min-w-0 items-center gap-3">
            <UserAvatar user={activeContact} size="sm" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-medium tracking-tight text-white">
                  {activeContact.profile.displayName}
                </p>
                <PresenceIndicator user={activeContact} compact />
                <span className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]">
                  <UserRound size={18} strokeWidth={1.5} />
                  DM
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]">
                  <Clock3 size={18} strokeWidth={1.5} />
                  D7
                </span>
              </div>
              <p className="truncate text-xs text-[var(--text-muted)]">
                @{activeContact.username}
              </p>
            </div>
          </div>

          <Button size="sm" variant="ghost">
            <ArrowLeft size={18} strokeWidth={1.5} />
            Back
          </Button>
        </div>

        <div className="border-b border-white/5 bg-[linear-gradient(180deg,rgba(255,255,255,0.018),transparent_48%),rgba(20,29,40,0.72)] px-4 py-4">
          <div className="premium-panel rounded-[28px] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="eyebrow-pill">Call scene</span>
                  <span className="status-pill">
                    <BellRing size={18} strokeWidth={1.5} />
                    Ready
                  </span>
                  <span className="status-pill">0 connected</span>
                </div>
                <p className="mt-3 text-sm text-[var(--text-dim)]">
                  Live media, screen share and call state stay anchored in the DM scene.
                </p>
              </div>
              <div className="flex gap-2 rounded-[20px] border border-white/6 bg-white/[0.03] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                <Button size="sm">Voice</Button>
                <Button size="sm" variant="secondary">
                  Video
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1">
          <MessageThread
            viewerId={previewViewer.id}
            messages={messages}
            isDeleting={null}
            lastReadAt={lastReadAt}
            onDelete={async () => undefined}
            onRetry={async () => undefined}
          />
        </div>

        <div className="border-t border-white/5 bg-[rgba(11,16,24,0.9)] px-4 py-3 backdrop-blur-xl">
          <MessageComposer disabled={false} onSend={async () => undefined} />
        </div>
      </div>
    </PreviewShell>
  );
}
