"use client";

import type {
  DmAttachment,
  DirectMessageAttachmentUploadResponse,
} from "@lobby/shared";
import { ApiClientError } from "@/lib/api-client";
import { resolveApiBaseUrlForBrowser, resolveApiBaseUrlForServer } from "@/lib/runtime-config";

export function getDirectMessageAttachmentAssetUrl(
  attachment: Pick<DmAttachment, "id" | "updatedAt">,
): string {
  const baseUrl =
    typeof window === "undefined"
      ? resolveApiBaseUrlForServer()
      : resolveApiBaseUrlForBrowser();
  const path = `/v1/direct-messages/attachments/${attachment.id}/asset?v=${encodeURIComponent(attachment.updatedAt)}`;

  return baseUrl ? `${baseUrl}${path}` : path;
}

export function getDirectMessageAttachmentStreamUrl(
  attachment: Pick<DmAttachment, "id" | "updatedAt">,
): string {
  const baseUrl =
    typeof window === "undefined"
      ? resolveApiBaseUrlForServer()
      : resolveApiBaseUrlForBrowser();
  const path = `/v1/direct-messages/attachments/${attachment.id}/stream?v=${encodeURIComponent(attachment.updatedAt)}`;

  return baseUrl ? `${baseUrl}${path}` : path;
}

export function getDirectMessageAttachmentPreviewUrl(
  attachment: Pick<DmAttachment, "id" | "updatedAt">,
): string {
  const baseUrl =
    typeof window === "undefined"
      ? resolveApiBaseUrlForServer()
      : resolveApiBaseUrlForBrowser();
  const path = `/v1/direct-messages/attachments/${attachment.id}/preview?v=${encodeURIComponent(attachment.updatedAt)}`;

  return baseUrl ? `${baseUrl}${path}` : path;
}

export function getDirectMessageAttachmentDownloadUrl(
  attachment: Pick<DmAttachment, "id" | "updatedAt">,
): string {
  const baseUrl =
    typeof window === "undefined"
      ? resolveApiBaseUrlForServer()
      : resolveApiBaseUrlForBrowser();
  const path = `/v1/direct-messages/attachments/${attachment.id}/download?v=${encodeURIComponent(attachment.updatedAt)}`;

  return baseUrl ? `${baseUrl}${path}` : path;
}

export function uploadDirectMessageAttachment(args: {
  conversationId: string;
  file: File;
  clientNonce: string;
  replyToMessageId?: string | null;
  onProgress?: (progress: number) => void;
}): Promise<DirectMessageAttachmentUploadResponse> {
  const apiBaseUrl = resolveApiBaseUrlForBrowser();

  if (!apiBaseUrl) {
    return Promise.reject(
      new ApiClientError(
        "API base URL is not configured. Set NEXT_PUBLIC_API_PUBLIC_URL/API_PUBLIC_URL.",
        "network_or_cors",
      ),
    );
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("file", args.file);
    formData.append("clientNonce", args.clientNonce);

    if (args.replyToMessageId) {
      formData.append("replyToMessageId", args.replyToMessageId);
    }

    xhr.open(
      "POST",
      `${apiBaseUrl}/v1/direct-messages/${args.conversationId}/attachments`,
    );
    xhr.withCredentials = true;
    xhr.responseType = "json";

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || !args.onProgress) {
        return;
      }

      args.onProgress(Math.max(0, Math.min(1, event.loaded / event.total)));
    };

    xhr.onerror = () => {
      reject(
        new ApiClientError(
          "Не удалось связаться с API. Проверьте адрес API, CORS и HTTPS-прокси.",
          "network_or_cors",
        ),
      );
    };

    xhr.onload = () => {
      const payload = xhr.response ?? tryParseJson(xhr.responseText);

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(payload as DirectMessageAttachmentUploadResponse);
        return;
      }

      const message =
        typeof payload?.error?.message === "string" && payload.error.message.trim()
          ? payload.error.message
          : typeof payload?.message === "string" && payload.message.trim()
            ? payload.message
            : `Ошибка запроса (${xhr.status})`;

      reject(new ApiClientError(message, "http_error", xhr.status));
    };

    xhr.send(formData);
  });
}

function tryParseJson(value: string | null | undefined): unknown {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
