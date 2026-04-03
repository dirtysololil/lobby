import { inviteListResponseSchema } from "@lobby/shared";
import { InviteAdminPanel } from "@/components/admin/invite-admin-panel";
import { fetchServerApi } from "@/lib/server-api";
import { requireAdminViewer } from "@/lib/server-session";

export default async function AdminInvitesPage() {
  await requireAdminViewer();
  const payload = await fetchServerApi("/v1/admin/invites");
  const invites = inviteListResponseSchema.parse(payload).items;

  return <InviteAdminPanel invites={invites} />;
}
