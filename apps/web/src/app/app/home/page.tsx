import { HomeWorkspace } from "@/components/home/home-workspace";
import { requireViewer } from "@/lib/server-session";

export default async function HomePage() {
  const viewer = await requireViewer();

  return <HomeWorkspace viewer={viewer} />;
}
