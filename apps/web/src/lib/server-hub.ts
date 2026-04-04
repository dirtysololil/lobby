import { hubShellResponseSchema } from "@lobby/shared";
import { fetchServerApi } from "./server-api";

export async function fetchServerHub(hubId: string) {
  const payload = await fetchServerApi(`/v1/hubs/${hubId}`);
  return hubShellResponseSchema.parse(payload).hub;
}
