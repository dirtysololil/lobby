import { apiErrorSchema } from "@lobby/shared";
import { cookies } from "next/headers";
import { runtimeConfig } from "./runtime-config";

export async function fetchServerApi<TResponse>(path: string): Promise<TResponse> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const response = await fetch(`${runtimeConfig.apiPublicUrl}${path}`, {
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
