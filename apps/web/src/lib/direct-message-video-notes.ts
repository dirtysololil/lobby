"use client";

import type { DmAttachment } from "@lobby/shared";

const VIDEO_NOTE_FILE_PREFIX = "lobby-video-note-";

export function isDirectMessageVideoNote(
  attachment: Pick<DmAttachment, "kind" | "originalName"> | null | undefined,
): boolean {
  return (
    attachment?.kind === "VIDEO" &&
    attachment.originalName.trim().toLowerCase().startsWith(VIDEO_NOTE_FILE_PREFIX)
  );
}

export function buildVideoNoteFileName(args?: {
  mimeType?: string | null;
  originalName?: string | null;
}): string {
  const extension = resolveVideoNoteExtension(args);

  return `${VIDEO_NOTE_FILE_PREFIX}${Date.now()}.${extension}`;
}

function resolveVideoNoteExtension(args?: {
  mimeType?: string | null;
  originalName?: string | null;
}) {
  const normalizedMimeType = args?.mimeType?.trim().toLowerCase() ?? "";
  const normalizedName = args?.originalName?.trim().toLowerCase() ?? "";

  if (
    normalizedMimeType.startsWith("video/mp4") ||
    normalizedName.endsWith(".mp4")
  ) {
    return "mp4";
  }

  return "webm";
}
