import { adminAuditLogListResponseSchema } from "@lobby/shared";
import { AdminNav } from "@/components/admin/admin-nav";
import { AuditLogPanel } from "@/components/admin/audit-log-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchServerApi } from "@/lib/server-api";
import { requireAdminViewer } from "@/lib/server-session";

interface AdminAuditPageProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

function getSingleValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export default async function AdminAuditPage({ searchParams }: AdminAuditPageProps) {
  await requireAdminViewer();
  const action = getSingleValue(searchParams?.action);
  const entityType = getSingleValue(searchParams?.entityType);
  const page = Number(getSingleValue(searchParams?.page) || "1");
  const params = new URLSearchParams({
    page: String(Number.isFinite(page) && page > 0 ? page : 1),
  });

  if (action) {
    params.set("action", action);
  }

  if (entityType) {
    params.set("entityType", entityType);
  }

  const payload = await fetchServerApi(`/v1/admin/audit?${params.toString()}`);
  const response = adminAuditLogListResponseSchema.parse(payload);

  return (
    <div className="grid gap-6">
      <AdminNav />
      <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 shadow-[var(--shadow)] backdrop-blur-xl">
        <form className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <Input name="action" placeholder="Action contains..." defaultValue={action} />
          <Input name="entityType" placeholder="Entity type..." defaultValue={entityType} />
          <Button type="submit" variant="secondary">
            Apply
          </Button>
        </form>
      </section>
      <AuditLogPanel response={response} />
    </div>
  );
}
