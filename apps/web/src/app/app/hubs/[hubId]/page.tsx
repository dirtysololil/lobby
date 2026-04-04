import { HubOverviewShell } from "@/components/hubs/hub-overview-shell";
import { fetchServerHub } from "@/lib/server-hub";

interface HubPageProps {
  params: Promise<{
    hubId: string;
  }>;
}

export default async function HubPage({ params }: HubPageProps) {
  const { hubId } = await params;
  const hub = await fetchServerHub(hubId);

  return <HubOverviewShell hub={hub} />;
}
