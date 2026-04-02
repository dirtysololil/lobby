import { apiErrorSchema } from "@lobby/shared";
import { cookies } from "next/headers";
import { resolveApiBaseUrlForServer } from "./runtime-config";

export async function fetchServerApi<TResponse>(path: string): Promise<TResponse> {
  const apiBaseUrl = resolveApiBaseUrlForServer();

  if (!apiBaseUrl) {
    throw new Error("API base URL is not configured for server runtime.");
  }

  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    cache: "no-store",
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
