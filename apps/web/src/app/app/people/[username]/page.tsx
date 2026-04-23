import {
  userSearchResponseSchema,
  type UserRelationshipSummary,
} from "@lobby/shared";
import { notFound } from "next/navigation";
import { UserProfileView } from "@/components/profile/user-profile-view";
import { fetchServerApi } from "@/lib/server-api";
import { requireViewer } from "@/lib/server-session";

interface UserProfilePageProps {
  params: Promise<{
    username: string;
  }>;
}

const selfRelationship: UserRelationshipSummary = {
  friendshipId: null,
  blockId: null,
  friendshipState: "NONE",
  isBlockedByViewer: false,
  hasBlockedViewer: false,
  dmConversationId: null,
};

export default async function UserProfilePage({ params }: UserProfilePageProps) {
  const viewer = await requireViewer();
  const { username } = await params;
  const normalizedUsername = decodeURIComponent(username).toLowerCase();

  if (viewer.username === normalizedUsername) {
    return (
      <UserProfileView
        viewer={viewer}
        initialUser={viewer}
        initialRelationship={selfRelationship}
      />
    );
  }

  let exactMatch = null;

  try {
    const payload = await fetchServerApi(
      `/v1/users/search?query=${encodeURIComponent(normalizedUsername)}`,
    );
    const items = userSearchResponseSchema.parse(payload).items;
    exactMatch =
      items.find((item) => item.user.username === normalizedUsername) ?? null;
  } catch {
    notFound();
  }

  if (!exactMatch) {
    notFound();
  }

  return (
    <UserProfileView
      viewer={viewer}
      initialUser={exactMatch.user}
      initialRelationship={exactMatch.relationship}
    />
  );
}
