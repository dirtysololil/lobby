import type { ReactNode } from "react";
import { hubShellResponseSchema } from "@lobby/shared";
import { HubLobbySidebar } from "@/components/hubs/hub-lobby-sidebar";
import { fetchServerApi } from "@/lib/server-api";

interface HubLayoutProps {
  children: ReactNode;
  params: Promise<{
    hubId: string;
  }>;
}

export default async function HubLayout({ children, params }: HubLayoutProps) {
  const { hubId } = await params;
  const payload = await fetchServerApi(`/v1/hubs/${hubId}`);
  const hub = hubShellResponseSchema.parse(payload).hub;

  return (
    <div className="grid min-h-0 gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
      <HubLobbySidebar hub={hub} />
      <div className="min-h-0">{children}</div>
    </div>
  );
}
