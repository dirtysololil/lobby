import { adminMediaLibraryResponseSchema } from "@lobby/shared";
import { MediaLibraryAdminPanel } from "@/components/admin/media-library-admin-panel";
import { fetchServerApi } from "@/lib/server-api";
import { requireAdminViewer } from "@/lib/server-session";

export default async function AdminMediaPage() {
  const viewer = await requireAdminViewer();
  const payload = await fetchServerApi("/v1/admin/media/library");
  const library = adminMediaLibraryResponseSchema.parse(payload).library;

  return <MediaLibraryAdminPanel viewer={viewer} initialLibrary={library} />;
}
