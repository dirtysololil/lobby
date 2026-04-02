import { HubLobbyView } from "@/components/hubs/hub-lobby-view";
import { hubShellResponseSchema } from "@lobby/shared";
import { fetchServerApi } from "@/lib/server-api";

interface HubLobbyPageProps {
  params: Promise<{
    hubId: string;
    lobbyId: string;
  }>;
}

export default async function HubLobbyPage({ params }: HubLobbyPageProps) {
  const { hubId, lobbyId } = await params;
  const payload = await fetchServerApi(`/v1/hubs/${hubId}`);
  const hub = hubShellResponseSchema.parse(payload).hub;

  return <HubLobbyView hub={hub} lobbyId={lobbyId} />;
}
