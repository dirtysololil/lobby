"use client";

import { apiErrorSchema } from "@lobby/shared";
import { runtimeConfig } from "./runtime-config";

export async function apiClientFetch<TResponse>(path: string, init?: RequestInit): Promise<TResponse> {
  const response = await fetch(`${runtimeConfig.apiPublicUrl}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    let message = "Request failed";

    try {
      const payload = apiErrorSchema.parse(await response.json());
      message = payload.error.message;
    } catch {
      message = response.statusText || message;
    }

    throw new Error(message);
  }

  return (await response.json()) as TResponse;
}
