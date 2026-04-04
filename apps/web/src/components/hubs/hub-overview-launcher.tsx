"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Layers3, Settings2, UsersRound } from "lucide-react";
import type { HubShell } from "@lobby/shared";
import { Button } from "@/components/ui/button";

const DynamicHubOverviewManagement = dynamic(
  () => import("./hub-overview").then((module) => module.HubOverview),
  {
    loading: () => (
      <div className="rounded-[18px] border border-[var(--border-soft)] bg-white/[0.03] px-4 py-4 text-sm text-[var(--text-dim)]">
        Loading hub tools...
      </div>
    ),
  },
);

interface HubOverviewLauncherProps {
  hubId: string;
  membersCount: number;
  lobbiesCount: number;
}

export function HubOverviewLauncher({
  hubId,
  membersCount,
  lobbiesCount,
}: HubOverviewLauncherProps) {
  const [open, setOpen] = useState(false);

  if (open) {
    return <DynamicHubOverviewManagement hubId={hubId} />;
  }

  return (
    <section className="premium-panel rounded-[22px] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="eyebrow-pill">
          <Settings2 className="h-3.5 w-3.5" />
          Hub tools
        </span>
      </div>
      <p className="mt-2 text-sm text-[var(--text-dim)]">
        The full roster, invite management, restrictions, and lobby creation tools are
        loaded only when needed so hub entry stays responsive.
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded-[16px] border border-[var(--border-soft)] bg-white/[0.03] px-3 py-3">
          <p className="text-xs text-[var(--text-muted)]">Members</p>
          <p className="mt-1 text-sm font-medium text-white">
            <UsersRound className="mr-1 inline h-4 w-4" />
            {membersCount}
          </p>
        </div>
        <div className="rounded-[16px] border border-[var(--border-soft)] bg-white/[0.03] px-3 py-3">
          <p className="text-xs text-[var(--text-muted)]">Spaces</p>
          <p className="mt-1 text-sm font-medium text-white">
            <Layers3 className="mr-1 inline h-4 w-4" />
            {lobbiesCount}
          </p>
        </div>
      </div>

      <Button type="button" onClick={() => setOpen(true)} className="mt-4 h-10 w-full">
        Open roster and tools
      </Button>
    </section>
  );
}
