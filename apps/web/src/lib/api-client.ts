"use client";

import { apiErrorSchema } from "@lobby/shared";
import { resolveApiBaseUrlForBrowser } from "./runtime-config";

export class ApiClientError extends Error {
  public constructor(
    message: string,
    public readonly code: "network_or_cors" | "http_error",
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export async function apiClientFetch<TResponse>(path: string, init?: RequestInit): Promise<TResponse> {
  const apiBaseUrl = resolveApiBaseUrlForBrowser();

  if (!apiBaseUrl) {
    throw new ApiClientError(
      "API base URL is not configured. Set NEXT_PUBLIC_API_PUBLIC_URL/API_PUBLIC_URL.",
      "network_or_cors",
    );
  }

  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;

  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        ...(!isFormData && init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });

    if (!response.ok) {
      throw new ApiClientError(await extractErrorMessage(response), "http_error", response.status);
    }

    return (await response.json()) as TResponse;
  } catch (error) {
    if (error instanceof TypeError) {
      throw new ApiClientError(
        "Network/CORS error: request did not reach API. Check API URL, CORS origin and HTTPS.",
        "network_or_cors",
      );
    }

    if (error instanceof ApiClientError) {
      throw error;
    }

    if (error instanceof Error) {
      throw new ApiClientError(error.message, "http_error");
    }

    throw new ApiClientError("Unknown API client error", "http_error");
  }
}

async function extractErrorMessage(response: Response): Promise<string> {
  const fallbackMessage =
    response.status === 401
      ? "Invalid login or password"
      : response.statusText || `Request failed (${response.status})`;
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
