"use client";

import { apiErrorSchema } from "@lobby/shared";
import { runtimeConfig } from "./runtime-config";

export async function apiClientFetch<TResponse>(path: string, init?: RequestInit): Promise<TResponse> {
  if (!runtimeConfig.apiPublicUrl) {
    throw new Error("Service is temporarily unavailable. Please try again later.");
  }

  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;

  try {
    const response = await fetch(`${runtimeConfig.apiPublicUrl}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        ...(!isFormData && init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(await extractErrorMessage(response));
    }

    return (await response.json()) as TResponse;
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error("Unable to reach API right now. Please try again.");
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Unable to reach API right now. Please try again.");
  }
}

async function extractErrorMessage(response: Response): Promise<string> {
  const fallbackMessage = response.statusText || `Request failed (${response.status})`;
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    return fallbackMessage;
  }

  try {
    const payload = await response.json();
    const parsedApiError = apiErrorSchema.safeParse(payload);

    if (parsedApiError.success) {
      return parsedApiError.data.error.message;
    }

    if (typeof payload?.message === "string" && payload.message.trim()) {
      return payload.message;
    }

    if (Array.isArray(payload?.message) && payload.message.length > 0) {
      return payload.message.join(", ");
    }

    if (typeof payload?.error === "string" && payload.error.trim()) {
      return payload.error;
    }
  } catch {
    return fallbackMessage;
  }

  return fallbackMessage;
}
