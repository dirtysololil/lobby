"use client";

import { apiErrorSchema } from "@lobby/shared";
import { runtimeConfig } from "./runtime-config";

export async function apiClientFetch<TResponse>(path: string, init?: RequestInit): Promise<TResponse> {
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
