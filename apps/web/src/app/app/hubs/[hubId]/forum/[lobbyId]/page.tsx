import { forumTopicListResponseSchema } from "@lobby/shared";
import { ForumLobbyView } from "@/components/forum/forum-lobby-view";
import { fetchServerApi } from "@/lib/server-api";
import { fetchServerHub } from "@/lib/server-hub";

interface ForumLobbyPageProps {
  params: Promise<{
    hubId: string;
    lobbyId: string;
  }>;
}

export default async function ForumLobbyPage({ params }: ForumLobbyPageProps) {
  const { hubId, lobbyId } = await params;
  const [hub, topicsPayload] = await Promise.all([
    fetchServerHub(hubId),
    fetchServerApi(`/v1/forum/hubs/${hubId}/lobbies/${lobbyId}/topics`),
  ]);
  const topics = forumTopicListResponseSchema.parse(topicsPayload).items;

  return <ForumLobbyView hub={hub} hubId={hubId} lobbyId={lobbyId} initialTopics={topics} />;
}
