import { ForumLobbyView } from "@/components/forum/forum-lobby-view";

interface ForumLobbyPageProps {
  params: Promise<{
    hubId: string;
    lobbyId: string;
  }>;
}

export default async function ForumLobbyPage({ params }: ForumLobbyPageProps) {
  const { hubId, lobbyId } = await params;

  return <ForumLobbyView hubId={hubId} lobbyId={lobbyId} />;
}
