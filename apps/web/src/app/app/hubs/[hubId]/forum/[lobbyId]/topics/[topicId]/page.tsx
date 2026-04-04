import { forumTopicDetailSchema } from "@lobby/shared";
import { ForumTopicView } from "@/components/forum/forum-topic-view";
import { fetchServerApi } from "@/lib/server-api";
import { fetchServerHub } from "@/lib/server-hub";

interface ForumTopicPageProps {
  params: Promise<{
    hubId: string;
    lobbyId: string;
    topicId: string;
  }>;
}

export default async function ForumTopicPage({ params }: ForumTopicPageProps) {
  const { hubId, lobbyId, topicId } = await params;
  const [hub, topicPayload] = await Promise.all([
    fetchServerHub(hubId),
    fetchServerApi(`/v1/forum/hubs/${hubId}/lobbies/${lobbyId}/topics/${topicId}`),
  ]);
  const topic = forumTopicDetailSchema.parse(topicPayload).topic;

  return (
    <ForumTopicView
      hub={hub}
      hubId={hubId}
      lobbyId={lobbyId}
      topicId={topicId}
      initialTopic={topic}
    />
  );
}
