import { inviteListResponseSchema } from "@lobby/shared";
import { AdminSectionNav } from "@/components/admin/admin-section-nav";
import { InviteAdminPanel } from "@/components/admin/invite-admin-panel";
import { fetchServerApi } from "@/lib/server-api";
import { requireAdminViewer } from "@/lib/server-session";

export default async function AdminInvitesPage() {
  await requireAdminViewer();
  const payload = await fetchServerApi("/v1/admin/invites");
  const invites = inviteListResponseSchema.parse(payload).items;

  return (
    <div className="grid gap-4">
      <AdminSectionNav />
      <InviteAdminPanel invites={invites} />
    </div>
  );
}
