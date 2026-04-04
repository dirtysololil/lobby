"use client";

import { CallRoomCanvas } from "./call-session-provider";

interface LiveKitCallRoomProps {
  callId: string | null;
  title: string;
  description: string;
}

export function LiveKitCallRoom({
  callId,
  title,
  description,
}: LiveKitCallRoomProps) {
  return <CallRoomCanvas callId={callId} title={title} description={description} />;
}
