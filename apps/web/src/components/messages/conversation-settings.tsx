"use client";

import type { DmNotificationSetting, DmRetentionMode } from "@lobby/shared";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

const notificationOptions: DmNotificationSetting[] = ["ALL", "MENTIONS_ONLY", "MUTED", "OFF"];
const retentionOptions: DmRetentionMode[] = ["OFF", "H24", "D7", "D30", "CUSTOM"];
const notificationLabels: Record<DmNotificationSetting, string> = {
  ALL: "Все",
  MENTIONS_ONLY: "Только упоминания",
  MUTED: "Без звука",
  OFF: "Отключены",
};
const retentionLabels: Record<DmRetentionMode, string> = {
  OFF: "Без автоудаления",
  H24: "24 часа",
  D7: "7 дней",
  D30: "30 дней",
  CUSTOM: "Свой период",
};

export function ConversationSettings({ notificationSetting, retentionMode, retentionSeconds, disabled, onSave }: ConversationSettingsProps) {
  const [localNotificationSetting, setLocalNotificationSetting] = useState(notificationSetting);
  const [localRetentionMode, setLocalRetentionMode] = useState(retentionMode);
  const [customHours, setCustomHours] = useState(retentionMode === "CUSTOM" && retentionSeconds ? String(Math.floor(retentionSeconds / 3600)) : "");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setLocalNotificationSetting(notificationSetting);
    setLocalRetentionMode(retentionMode);
    setCustomHours(retentionMode === "CUSTOM" && retentionSeconds ? String(Math.floor(retentionSeconds / 3600)) : "");
  }, [notificationSetting, retentionMode, retentionSeconds]);

  async function handleSave() {
    setIsSaving(true);
    try {
      await onSave({ notificationSetting: localNotificationSetting, retentionMode: localRetentionMode, customHours: localRetentionMode === "CUSTOM" && customHours ? Number(customHours) : null });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="grid gap-4 rounded-3xl border border-[var(--border)] bg-slate-950/35 p-5">
      <div className="grid gap-2">
        <label className="text-xs uppercase tracking-[0.18em] text-cyan-200/70">Уведомления</label>
        <select value={localNotificationSetting} onChange={(event) => setLocalNotificationSetting(event.target.value as DmNotificationSetting)} className="h-11 rounded-2xl border border-[var(--border)] bg-slate-950/50 px-4 text-sm text-white outline-none" disabled={disabled || isSaving}>
          {notificationOptions.map((option) => <option key={option} value={option}>{notificationLabels[option]}</option>)}
        </select>
      </div>

      <div className="grid gap-2">
        <label className="text-xs uppercase tracking-[0.18em] text-cyan-200/70">Хранение</label>
        <select value={localRetentionMode} onChange={(event) => setLocalRetentionMode(event.target.value as DmRetentionMode)} className="h-11 rounded-2xl border border-[var(--border)] bg-slate-950/50 px-4 text-sm text-white outline-none" disabled={disabled || isSaving}>
          {retentionOptions.map((option) => <option key={option} value={option}>{retentionLabels[option]}</option>)}
        </select>
      </div>

      {localRetentionMode === "CUSTOM" ? (
        <div className="grid gap-2">
          <label className="text-xs uppercase tracking-[0.18em] text-cyan-200/70">Период (часы)</label>
          <Input value={customHours} onChange={(event) => setCustomHours(event.target.value)} inputMode="numeric" placeholder="72" disabled={disabled || isSaving} />
        </div>
      ) : null}

      <Button variant="secondary" onClick={() => void handleSave()} disabled={disabled || isSaving}>{isSaving ? "Сохраняем..." : "Сохранить"}</Button>
    </div>
  );
}
