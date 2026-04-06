import { adminAuditLogListResponseSchema } from "@lobby/shared";
import { AuditAdminActions } from "@/components/admin/audit-admin-actions";
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

  if (action) {
    params.set("action", action);
  }

  if (entityType) {
    params.set("entityType", entityType);
  }

  const payload = await fetchServerApi(`/v1/admin/audit?${params.toString()}`);
  const response = adminAuditLogListResponseSchema.parse(payload);
  const pageStart = response.total === 0 ? 0 : (response.page - 1) * response.pageSize + 1;
  const pageEnd = Math.min(response.total, response.page * response.pageSize);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <section className="premium-panel shrink-0 rounded-[24px] p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <p className="section-kicker">Фильтры аудита</p>
            <p className="mt-2 text-sm leading-6 text-[var(--text-dim)]">
              Сужайте поток по действию и типу сущности. Список ниже прокручивается
              отдельно и не ломает высоту страницы.
            </p>
          </div>
          <div className="grid gap-3 xl:max-w-[440px] xl:justify-items-end">
            <div className="grid gap-2 text-sm text-[var(--text-muted)] xl:text-right">
              <span className="status-pill justify-center xl:justify-end">
              Строки {pageStart}-{pageEnd} из {response.total}
              </span>
              <span>Страница {response.page}</span>
            </div>
            <AuditAdminActions />
          </div>
        </div>

        <form className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <Input
            name="action"
            placeholder="Действие содержит..."
            defaultValue={action}
          />
          <Input
            name="entityType"
            placeholder="Тип сущности..."
            defaultValue={entityType}
          />
          <Button type="submit" variant="secondary">
            Применить
          </Button>
        </form>
      </section>

      <AuditLogPanel response={response} />
    </div>
  );
}
