"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Layers3, Settings2, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";

const DynamicHubOverviewManagement = dynamic(
  () => import("./hub-overview").then((module) => module.HubOverview),
  {
    loading: () => (
      <div className="rounded-[18px] border border-[var(--border-soft)] bg-white/[0.03] px-4 py-4 text-sm text-[var(--text-dim)]">
        Загружаем инструменты хаба...
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
    <section className="premium-panel rounded-[22px] p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="section-kicker">Инструменты хаба</p>
          <p className="mt-1 text-sm font-medium text-white">
            Роли, инвайты и каналы
          </p>
        </div>
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] border border-white/8 bg-white/[0.04] text-[var(--accent)]">
          <Settings2 className="h-4 w-4" />
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className="glass-badge">
          <UsersRound className="h-3.5 w-3.5" />
          {membersCount} участников
        </span>
        <span className="glass-badge">
          <Layers3 className="h-3.5 w-3.5" />
          {lobbiesCount} пространств
        </span>
      </div>

      <Button
        type="button"
        variant="secondary"
        onClick={() => setOpen(true)}
        className="mt-3 h-9 w-full"
      >
        Управление хабом
      </Button>
    </section>
  );
}
