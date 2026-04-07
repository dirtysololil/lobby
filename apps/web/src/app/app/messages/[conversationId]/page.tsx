import { ConversationView } from "@/components/messages/conversation-view";
import { requireViewer } from "@/lib/server-session";

interface ConversationPageProps {
  params: Promise<{
    conversationId: string;
  }>;
}

export default async function ConversationPage({ params }: ConversationPageProps) {
  const viewer = await requireViewer();
  const { conversationId } = await params;

  return (
    <ConversationView
      conversationId={conversationId}
      viewerId={viewer.id}
      viewerRole={viewer.role}
    />
  );
}
