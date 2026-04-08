"use client";

import { apiErrorSchema } from "@lobby/shared";
import { resolveApiBaseUrlForBrowser } from "./runtime-config";

export class ApiClientError extends Error {
  public constructor(
    message: string,
    public readonly code: "network_or_cors" | "http_error",
    public readonly status?: number,
    public readonly apiCode?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function performApiRequest(path: string, init?: RequestInit) {
  const apiBaseUrl = resolveApiBaseUrlForBrowser();

  if (!apiBaseUrl) {
    throw new ApiClientError(
      "API base URL is not configured. Set NEXT_PUBLIC_API_PUBLIC_URL/API_PUBLIC_URL.",
      "network_or_cors",
    );
  }

  const isFormData =
    typeof FormData !== "undefined" && init?.body instanceof FormData;

  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        ...(!isFormData && init?.body
          ? { "Content-Type": "application/json" }
          : {}),
        ...init?.headers,
      },
    });

    if (!response.ok) {
      const payload = await extractErrorPayload(response);
      throw new ApiClientError(
        payload.message,
        "http_error",
        response.status,
        payload.apiCode,
        payload.details,
      );
    }

    return response;
  } catch (error) {
    if (
      error instanceof DOMException &&
      error.name === "AbortError"
    ) {
      throw new ApiClientError(
        "Запрос превысил лимит ожидания. Попробуйте ещё раз.",
        "network_or_cors",
      );
    }

    if (error instanceof TypeError) {
      throw new ApiClientError(
        "Не удалось связаться с API. Проверьте адрес API, CORS и HTTPS-прокси.",
        "network_or_cors",
      );
    }

    if (error instanceof ApiClientError) {
      throw error;
    }

    if (error instanceof Error) {
      throw new ApiClientError(error.message, "http_error");
    }

    throw new ApiClientError("Неизвестная ошибка API-клиента.", "http_error");
  }
}

export async function apiClientFetch<TResponse>(
  path: string,
  init?: RequestInit,
): Promise<TResponse> {
  const response = await performApiRequest(path, init);

  return (await response.json()) as TResponse;
}

export async function apiClientFetchBlob(
  path: string,
  init?: RequestInit,
): Promise<Blob> {
  const response = await performApiRequest(path, init);

  return await response.blob();
}

async function extractErrorPayload(response: Response): Promise<{
  message: string;
  apiCode?: string;
  details?: unknown;
}> {
  const fallbackMessage =
    response.status === 401
      ? "Неверный логин, почта или пароль."
      : `Ошибка запроса (${response.status})`;
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    return {
      message: fallbackMessage,
    };
  }

  try {
    const payload = await response.json();
    const parsedApiError = apiErrorSchema.safeParse(payload);

    if (parsedApiError.success) {
      return {
        message: parsedApiError.data.error.message,
        apiCode: parsedApiError.data.error.code,
        details: parsedApiError.data.error.details,
      };
    }

    if (typeof payload?.message === "string" && payload.message.trim()) {
      return {
        message: payload.message,
      };
    }

    if (Array.isArray(payload?.message) && payload.message.length > 0) {
      return {
        message: payload.message.join(", "),
      };
    }

    if (typeof payload?.error === "string" && payload.error.trim()) {
      return {
        message: payload.error,
      };
    }
  } catch {
    return {
      message: fallbackMessage,
    };
  }

  return {
    message: fallbackMessage,
  };
}
