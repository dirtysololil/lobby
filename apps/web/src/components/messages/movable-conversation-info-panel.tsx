"use client";

import type { DmNotificationSetting, DmRetentionMode } from "@lobby/shared";
import { BellRing, Clock3, X } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { dmNotificationLabels, dmRetentionLabels } from "@/lib/ui-labels";
import { ConversationSettings } from "./conversation-settings";

interface MovableConversationInfoPanelProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  conversationId: string;
  isOpen: boolean;
  notificationSetting: DmNotificationSetting;
  retentionMode: DmRetentionMode;
  retentionSeconds: number | null;
  onClose?: () => void;
  onSave: (payload: {
    notificationSetting: DmNotificationSetting;
    retentionMode: DmRetentionMode;
    customHours: number | null;
  }) => Promise<void>;
}

export function MovableConversationInfoPanel({
  containerRef,
  conversationId,
  isOpen,
  notificationSetting,
  retentionMode,
  retentionSeconds,
  onClose,
  onSave,
}: MovableConversationInfoPanelProps) {
  void containerRef;
  void conversationId;

  const metaChips = useMemo(
    () => [
      {
        icon: <BellRing className="h-3.5 w-3.5" />,
        label: dmNotificationLabels[notificationSetting],
      },
      {
        icon: <Clock3 className="h-3.5 w-3.5" />,
        label: dmRetentionLabels[retentionMode],
      },
    ],
    [notificationSetting, retentionMode],
  );

  if (!isOpen) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-20 hidden md:block">
      <div className="pointer-events-auto absolute right-4 top-4 w-[min(320px,calc(100%-2rem))] max-w-[320px] rounded-[22px] border border-white/8 bg-black p-3 shadow-[0_24px_60px_rgba(4,8,16,0.34)]">
        {onClose ? (
          <Button
            size="sm"
            variant="ghost"
            className="absolute right-3 top-3 h-8 w-8 rounded-[12px] border border-white/8 bg-black px-0 text-[var(--text-muted)] hover:bg-black hover:text-white"
            onClick={onClose}
            aria-label="Закрыть панель"
            title="Закрыть панель"
          >
            <X className="h-4 w-4" />
          </Button>
        ) : null}

        <div className="pr-11">
          <div className="flex flex-wrap gap-1.5">
            {metaChips.map((item) => (
              <span key={item.label} className="status-pill">
                {item.icon}
                {item.label}
              </span>
            ))}
          </div>

          <div className="mt-3">
            <ConversationSettings
              notificationSetting={notificationSetting}
              retentionMode={retentionMode}
              retentionSeconds={retentionSeconds}
              disabled={false}
              onSave={onSave}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
