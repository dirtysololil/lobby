import { authSessionResponseSchema, type PublicUser } from "@lobby/shared";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { resolveApiBaseUrlForServer } from "./runtime-config";

export async function fetchViewer(): Promise<PublicUser | null> {
  const apiBaseUrl = resolveApiBaseUrlForServer();

  if (!apiBaseUrl) {
    return null;
  }

  try {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();

    const response = await fetch(`${apiBaseUrl}/v1/auth/me`, {
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const payload = authSessionResponseSchema.parse(await response.json());
    return payload.user;
  } catch {
    return null;
  }
}

export async function requireViewer(): Promise<PublicUser> {
  const viewer = await fetchViewer();

  if (!viewer) {
    redirect("/login");
  }

  return viewer;
}

export async function requireAdminViewer(): Promise<PublicUser> {
  const viewer = await requireViewer();

  if (viewer.role !== "OWNER" && viewer.role !== "ADMIN") {
    redirect("/app");
  }

  return viewer;
}
