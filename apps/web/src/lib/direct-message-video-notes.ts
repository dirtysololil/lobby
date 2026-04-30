"use client";

import type { DmAttachment } from "@lobby/shared";

const VIDEO_NOTE_FILE_PREFIX = "lobby-video-note-";
const VOICE_NOTE_FILE_PREFIX = "lobby-voice-note-";

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

export function isDirectMessageVoiceNote(
  attachment: Pick<DmAttachment, "kind" | "originalName" | "mimeType"> | null | undefined,
): boolean {
  return (
    attachment?.kind === "DOCUMENT" &&
    (attachment.originalName.trim().toLowerCase().startsWith(VOICE_NOTE_FILE_PREFIX) ||
      attachment.mimeType.trim().toLowerCase().startsWith("audio/"))
  );
}

export function buildVoiceNoteFileName(args?: {
  mimeType?: string | null;
  originalName?: string | null;
}): string {
  const extension = resolveVoiceNoteExtension(args);

  return `${VOICE_NOTE_FILE_PREFIX}${Date.now()}.${extension}`;
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

function resolveVoiceNoteExtension(args?: {
  mimeType?: string | null;
  originalName?: string | null;
}) {
  const normalizedMimeType = args?.mimeType?.trim().toLowerCase() ?? "";
  const normalizedName = args?.originalName?.trim().toLowerCase() ?? "";

  if (
    normalizedMimeType.includes("mpeg") ||
    normalizedName.endsWith(".mp3")
  ) {
    return "mp3";
  }

  if (
    normalizedMimeType.includes("mp4") ||
    normalizedName.endsWith(".m4a")
  ) {
    return "m4a";
  }

  if (normalizedName.endsWith(".ogg") || normalizedMimeType.includes("ogg")) {
    return "ogg";
  }

  return "webm";
}
