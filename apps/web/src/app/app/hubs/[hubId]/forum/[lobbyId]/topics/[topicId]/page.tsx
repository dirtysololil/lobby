import { ForumTopicView } from "@/components/forum/forum-topic-view";

interface ForumTopicPageProps {
  params: Promise<{
    hubId: string;
    lobbyId: string;
    topicId: string;
  }>;
}

export default async function ForumTopicPage({ params }: ForumTopicPageProps) {
  const { hubId, lobbyId, topicId } = await params;

  return <ForumTopicView hubId={hubId} lobbyId={lobbyId} topicId={topicId} />;
}
