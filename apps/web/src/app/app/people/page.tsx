import { PeopleWorkspace } from "@/components/people/people-workspace";
import { requireViewer } from "@/lib/server-session";

export default async function PeoplePage() {
  const viewer = await requireViewer();

  return <PeopleWorkspace viewer={viewer} />;
}
