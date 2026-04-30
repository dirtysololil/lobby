import { forumTopicListResponseSchema } from "@lobby/shared";
import { HubOverviewShell } from "@/components/hubs/hub-overview-shell";
import { fetchServerApi } from "@/lib/server-api";
import { fetchServerHub } from "@/lib/server-hub";

interface HubPageProps {
  params: Promise<{
    hubId: string;
  }>;
}

export default async function HubPage({ params }: HubPageProps) {
  const { hubId } = await params;
  const hub = await fetchServerHub(hubId);
  const feedLobby = hub.lobbies.find((item) => item.type === "TEXT") ?? null;
  const feedTopics = feedLobby
    ? forumTopicListResponseSchema.parse(
        await fetchServerApi(
          `/v1/forum/hubs/${hubId}/lobbies/${feedLobby.id}/topics`,
        ),
      ).items
    : [];

  return <HubOverviewShell hub={hub} feedTopics={feedTopics} />;
}
