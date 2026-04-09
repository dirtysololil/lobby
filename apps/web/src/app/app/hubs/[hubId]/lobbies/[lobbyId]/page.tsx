import { HubLobbyView } from "@/components/hubs/hub-lobby-view";
import { forumTopicListResponseSchema } from "@lobby/shared";
import { fetchServerApi } from "@/lib/server-api";
import { fetchServerHub } from "@/lib/server-hub";

interface HubLobbyPageProps {
  params: Promise<{
    hubId: string;
    lobbyId: string;
  }>;
}

export default async function HubLobbyPage({ params }: HubLobbyPageProps) {
  const { hubId, lobbyId } = await params;
  const hub = await fetchServerHub(hubId);
  const lobby = hub.lobbies.find((item) => item.id === lobbyId);
  const initialTextTopics =
    lobby?.type === "TEXT"
      ? forumTopicListResponseSchema.parse(
          await fetchServerApi(`/v1/forum/hubs/${hubId}/lobbies/${lobbyId}/topics`),
        ).items
      : [];

  return (
    <HubLobbyView
      hub={hub}
      lobbyId={lobbyId}
      initialTextTopics={initialTextTopics}
    />
  );
}
