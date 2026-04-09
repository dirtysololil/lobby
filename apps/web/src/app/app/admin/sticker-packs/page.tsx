import { adminStickerPacksResponseSchema } from "@lobby/shared";
import { AdminSectionNav } from "@/components/admin/admin-section-nav";
import { StickerPacksAdminPanel } from "@/components/admin/sticker-packs-admin-panel";
import { fetchServerApi } from "@/lib/server-api";
import { requireAdminViewer } from "@/lib/server-session";

export default async function AdminStickerPacksPage() {
  await requireAdminViewer();
  const payload = await fetchServerApi("/v1/stickers/admin/packs");
  const packs = adminStickerPacksResponseSchema.parse(payload).packs;

  return (
    <div className="grid gap-4">
      <AdminSectionNav />
      <StickerPacksAdminPanel initialPacks={packs} />
    </div>
  );
}
