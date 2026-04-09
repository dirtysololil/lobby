import { adminMediaLibraryResponseSchema } from "@lobby/shared";
import { AdminSectionNav } from "@/components/admin/admin-section-nav";
import { MediaLibraryAdminPanel } from "@/components/admin/media-library-admin-panel";
import { fetchServerApi } from "@/lib/server-api";
import { requireAdminViewer } from "@/lib/server-session";

export default async function AdminMediaPage() {
  const viewer = await requireAdminViewer();
  const payload = await fetchServerApi("/v1/admin/media/library");
  const library = adminMediaLibraryResponseSchema.parse(payload).library;

  return (
    <div className="grid gap-4">
      <AdminSectionNav />
      <MediaLibraryAdminPanel viewer={viewer} initialLibrary={library} />
    </div>
  );
}
