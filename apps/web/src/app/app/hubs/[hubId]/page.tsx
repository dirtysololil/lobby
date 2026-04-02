import { HubOverview } from "@/components/hubs/hub-overview";

interface HubPageProps {
  params: Promise<{
    hubId: string;
  }>;
}

export default async function HubPage({ params }: HubPageProps) {
  const { hubId } = await params;

  return <HubOverview hubId={hubId} />;
}
