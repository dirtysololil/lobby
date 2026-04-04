import type { ReactNode } from "react";

interface HubLayoutProps {
  children: ReactNode;
  params: Promise<{
    hubId: string;
  }>;
}

export default async function HubLayout({ children, params }: HubLayoutProps) {
  await params;

  return <div className="h-full min-h-0 overflow-hidden">{children}</div>;
}
