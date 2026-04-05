import { adminUserListResponseSchema } from "@lobby/shared";
import { UsersAdminPanel } from "@/components/admin/users-admin-panel";
import { fetchServerApi } from "@/lib/server-api";
import { requireAdminViewer } from "@/lib/server-session";

interface AdminUsersPageProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

function getSingleValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const viewer = await requireAdminViewer();
  const query = getSingleValue(searchParams?.query);
  const role = getSingleValue(searchParams?.role);
  const blocked = getSingleValue(searchParams?.blocked) || "all";
  const page = Number(getSingleValue(searchParams?.page) || "1");
  const params = new URLSearchParams({
    blocked,
    page: String(Number.isFinite(page) && page > 0 ? page : 1),
  });

  if (query) {
    params.set("query", query);
  }

  if (role) {
    params.set("role", role);
  }

  const payload = await fetchServerApi(`/v1/admin/users?${params.toString()}`);
  const response = adminUserListResponseSchema.parse(payload);

  return (
    <UsersAdminPanel
      viewer={viewer}
      response={response}
      filters={{
        query,
        role,
        blocked,
        page: response.page,
      }}
    />
  );
}
