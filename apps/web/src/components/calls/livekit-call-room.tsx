"use client";

import dynamic from "next/dynamic";

const DynamicCallRoomCanvas = dynamic(
  () => import("./call-session-provider").then((module) => module.CallRoomCanvas),
  {
    loading: () => (
      <div className="rounded-[20px] border border-[var(--border)] bg-white/[0.03] px-4 py-4 text-sm text-[var(--text-dim)]">
        Preparing call canvas...
      </div>
    ),
  },
);

interface LiveKitCallRoomProps {
  callId: string | null;
  title: string;
  description: string;
  variant?: "default" | "conversation";
}

export function LiveKitCallRoom({
  callId,
  title,
  description,
  variant = "default",
}: LiveKitCallRoomProps) {
  if (!callId) {
    return null;
  }

  return (
    <DynamicCallRoomCanvas
      callId={callId}
      title={title}
      description={description}
      variant={variant}
    />
  );
}
