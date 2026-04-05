"use client";

import type { DmNotificationSetting, DmRetentionMode } from "@lobby/shared";
import { BellRing, Clock3 } from "lucide-react";
import { useEffect, useState } from "react";
import { SelectField } from "@/components/ui/select-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { dmNotificationLabels, dmRetentionLabels } from "@/lib/ui-labels";

interface ConversationSettingsProps {
  notificationSetting: DmNotificationSetting;
  retentionMode: DmRetentionMode;
  retentionSeconds: number | null;
  disabled: boolean;
  onSave: (payload: {
    notificationSetting: DmNotificationSetting;
    retentionMode: DmRetentionMode;
    customHours: number | null;
  }) => Promise<void>;
}

const notificationOptions: DmNotificationSetting[] = [
  "ALL",
  "MENTIONS_ONLY",
  "MUTED",
  "OFF",
];

const retentionOptions: DmRetentionMode[] = ["OFF", "H24", "D7", "D30", "CUSTOM"];

export function ConversationSettings({
  notificationSetting,
  retentionMode,
  retentionSeconds,
  disabled,
  onSave,
}: ConversationSettingsProps) {
  const [localNotificationSetting, setLocalNotificationSetting] =
    useState(notificationSetting);
  const [localRetentionMode, setLocalRetentionMode] = useState(retentionMode);
  const [customHours, setCustomHours] = useState(
    retentionMode === "CUSTOM" && retentionSeconds
      ? String(Math.floor(retentionSeconds / 3600))
      : "",
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setLocalNotificationSetting(notificationSetting);
    setLocalRetentionMode(retentionMode);
    setCustomHours(
      retentionMode === "CUSTOM" && retentionSeconds
        ? String(Math.floor(retentionSeconds / 3600))
        : "",
    );
  }, [notificationSetting, retentionMode, retentionSeconds]);

  async function handleSave() {
    setIsSaving(true);

    try {
      await onSave({
        notificationSetting: localNotificationSetting,
        retentionMode: localRetentionMode,
        customHours:
          localRetentionMode === "CUSTOM" && customHours ? Number(customHours) : null,
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="grid gap-3">
      <div className="rounded-[16px] border border-[var(--border-soft)] bg-white/[0.03] px-3 py-2.5 text-sm text-[var(--text-dim)]">
        Эти параметры относятся только к текущему диалогу и не меняют остальные ЛС.
      </div>

      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <label className="section-kicker inline-flex items-center gap-1.5">
            <BellRing className="h-3.5 w-3.5 text-[var(--text-muted)]" />
            Уведомления
          </label>
          <SelectField
            value={localNotificationSetting}
            onChange={(event) =>
              setLocalNotificationSetting(event.target.value as DmNotificationSetting)
            }
            disabled={disabled || isSaving}
          >
            {notificationOptions.map((option) => (
              <option key={option} value={option}>
                {dmNotificationLabels[option]}
              </option>
            ))}
          </SelectField>
        </div>

        <div className="grid gap-1.5">
          <label className="section-kicker inline-flex items-center gap-1.5">
            <Clock3 className="h-3.5 w-3.5 text-[var(--text-muted)]" />
            История
          </label>
          <SelectField
            value={localRetentionMode}
            onChange={(event) => setLocalRetentionMode(event.target.value as DmRetentionMode)}
            disabled={disabled || isSaving}
          >
            {retentionOptions.map((option) => (
              <option key={option} value={option}>
                {dmRetentionLabels[option]}
              </option>
            ))}
          </SelectField>
        </div>

        {localRetentionMode === "CUSTOM" ? (
          <div className="grid gap-1.5">
            <label className="section-kicker">Свой срок</label>
            <Input
              value={customHours}
              onChange={(event) => setCustomHours(event.target.value)}
              inputMode="numeric"
              placeholder="72"
              disabled={disabled || isSaving}
              className="h-10"
            />
          </div>
        ) : null}
      </div>

      <Button
        size="sm"
        variant="secondary"
        onClick={() => void handleSave()}
        disabled={disabled || isSaving}
        className="h-9"
      >
        {isSaving ? "Сохраняем..." : "Сохранить настройки"}
      </Button>
    </div>
  );
}
