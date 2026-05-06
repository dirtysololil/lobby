import { apiErrorSchema } from "@lobby/shared";
import { cookies } from "next/headers";
import { resolveApiBaseUrlForServerRequest } from "./runtime-config";

function serializeCookieHeader(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
): string {
  return cookieStore
    .getAll()
    .map(({ name, value }) => `${name}=${encodeURIComponent(value)}`)
    .join("; ");
}

export async function fetchServerApi<TResponse>(
  path: string,
): Promise<TResponse> {
  const apiBaseUrl = await resolveApiBaseUrlForServerRequest();

  if (!apiBaseUrl) {
    throw new Error("API base URL is not configured for server runtime.");
  }

  const cookieStore = await cookies();
  const cookieHeader = serializeCookieHeader(cookieStore);
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    cache: "no-store",
  });

  if (!response.ok) {
    let message = "Не удалось выполнить запрос.";

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
