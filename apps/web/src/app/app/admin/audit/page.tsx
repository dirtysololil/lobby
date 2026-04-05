import { adminAuditLogListResponseSchema } from "@lobby/shared";
import { AuditLogPanel } from "@/components/admin/audit-log-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchServerApi } from "@/lib/server-api";
import { requireAdminViewer } from "@/lib/server-session";

interface AdminAuditPageProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

function getSingleValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function AdminAuditPage({
  searchParams,
}: AdminAuditPageProps) {
  await requireAdminViewer();
  const action = getSingleValue(searchParams?.action);
  const entityType = getSingleValue(searchParams?.entityType);
  const page = Number(getSingleValue(searchParams?.page) || "1");
  const params = new URLSearchParams({
    page: String(Number.isFinite(page) && page > 0 ? page : 1),
  });
  if (action) params.set("action", action);
  if (entityType) params.set("entityType", entityType);

  const payload = await fetchServerApi(`/v1/admin/audit?${params.toString()}`);
  const response = adminAuditLogListResponseSchema.parse(payload);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <section className="premium-panel shrink-0 rounded-[24px] p-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="section-kicker">Р¤РёР»СЊС‚СЂС‹ Р°СѓРґРёС‚Р°</p>
            <p className="mt-2 text-sm leading-6 text-[var(--text-dim)]">
              РЎСѓР·СЊС‚Рµ РїРѕС‚РѕРє РїРѕ РґРµР№СЃС‚РІРёСЋ РёР»Рё С‚РёРїСѓ СЃСѓС‰РЅРѕСЃС‚Рё. РЎРїРёСЃРѕРє Р·Р°РїРёСЃРµР№ РЅРёР¶Рµ СЃРєСЂРѕР»Р»РёС‚СЃСЏ
              РІ РѕС‚РґРµР»СЊРЅРѕРј viewport Рё РЅРµ Р»РѕРјР°РµС‚ РІС‹СЃРѕС‚Сѓ route.
            </p>
          </div>
        </div>

        <form className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <Input name="action" placeholder="Р”РµР№СЃС‚РІРёРµ СЃРѕРґРµСЂР¶РёС‚..." defaultValue={action} />
          <Input
            name="entityType"
            placeholder="РўРёРї СЃСѓС‰РЅРѕСЃС‚Рё..."
            defaultValue={entityType}
          />
          <Button type="submit" variant="secondary">
            РџСЂРёРјРµРЅРёС‚СЊ
          </Button>
        </form>
      </section>

      <AuditLogPanel response={response} />
    </div>
  );
}
