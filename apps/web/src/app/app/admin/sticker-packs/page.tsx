import { adminMediaLibraryResponseSchema } from "@lobby/shared";
import { StickerPacksAdminPanel } from "@/components/admin/sticker-packs-admin-panel";
import { fetchServerApi } from "@/lib/server-api";
import { requireAdminViewer } from "@/lib/server-session";

export default async function AdminStickerPacksPage() {
  const viewer = await requireAdminViewer();
  const payload = await fetchServerApi("/v1/admin/media/library");
  const library = adminMediaLibraryResponseSchema.parse(payload).library;

  return (
    <StickerPacksAdminPanel
      viewer={viewer}
      initialPacks={library.stickerPacks}
    />
  );
}
