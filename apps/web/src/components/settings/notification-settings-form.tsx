"use client";

import { BellRing, Layers3, Sparkles, Volume2 } from "lucide-react";
import type {
  HubNotificationSettingResponse,
  LobbyNotificationSettingResponse,
  NotificationSetting,
  UpdateViewerNotificationDefaultsInput,
  UserNotificationSettingsOverview,
  UserNotificationSettingsResponse,
} from "@lobby/shared";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import {
  CompactList,
  CompactListCount,
  CompactListHeader,
  CompactListMeta,
  CompactListRow,
} from "@/components/ui/compact-list";
import { SelectField } from "@/components/ui/select-field";
import { Button } from "@/components/ui/button";
import { apiClientFetch } from "@/lib/api-client";

interface NotificationSettingsFormProps {
  initialSettings: UserNotificationSettingsOverview;
}

const notificationOptions: NotificationSetting[] = [
  "ALL",
  "MENTIONS_ONLY",
  "MUTED",
  "OFF",
];
const notificationLabels: Record<NotificationSetting, string> = {
  ALL: "All activity",
  MENTIONS_ONLY: "Mentions only",
  MUTED: "Muted",
  OFF: "Off",
};

export function NotificationSettingsForm({
  initialSettings,
}: NotificationSettingsFormProps) {
  const router = useRouter();
  const [defaults, setDefaults] =
    useState<UpdateViewerNotificationDefaultsInput>(initialSettings.defaults);
  const [isSavingDefaults, setIsSavingDefaults] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function saveDefaults() {
    setError(null);
    setMessage(null);
    setIsSavingDefaults(true);

    try {
      await apiClientFetch<UserNotificationSettingsResponse>(
        "/v1/users/me/notification-settings",
        {
          method: "PATCH",
          body: JSON.stringify(defaults),
        },
      );
      setMessage("Default notification rules saved.");
      router.refresh();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save notification settings.",
      );
    } finally {
      setIsSavingDefaults(false);
    }
  }

  async function updateHubSetting(
    hubId: string,
    notificationSetting: NotificationSetting,
  ) {
    setError(null);
    setMessage(null);

    try {
      await apiClientFetch<HubNotificationSettingResponse>(
        `/v1/hubs/${hubId}/notification-settings`,
        {
          method: "PATCH",
          body: JSON.stringify({ notificationSetting }),
        },
      );
      setMessage("Hub rule updated.");
      router.refresh();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Unable to update the hub rule.",
      );
    }
  }

  async function updateLobbySetting(
    hubId: string,
    lobbyId: string,
    notificationSetting: NotificationSetting,
  ) {
    setError(null);
    setMessage(null);

    try {
      await apiClientFetch<LobbyNotificationSettingResponse>(
        `/v1/hubs/${hubId}/lobbies/${lobbyId}/notification-settings`,
        {
          method: "PATCH",
          body: JSON.stringify({ notificationSetting }),
        },
      );
      setMessage("Lobby rule updated.");
      router.refresh();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to update the lobby rule.",
      );
    }
  }

  return (
    <div className="grid gap-3">
      <section className="premium-panel overflow-hidden rounded-[22px]">
        <div className="border-b border-[var(--border-soft)] px-4 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <CompactListMeta>
              <BellRing size={14} strokeWidth={1.5} />
              Defaults
            </CompactListMeta>
            <CompactListMeta>Communication baseline</CompactListMeta>
          </div>
          <p className="mt-2 text-sm text-[var(--text-dim)]">
            Set the fallback behavior for new DMs, hubs, and lobbies before any local
            overrides kick in.
          </p>
        </div>

        <CompactList>
          {[
            {
              key: "dmNotificationDefault" as const,
              label: "Direct messages",
              description: "Used when a brand-new DM thread opens.",
              icon: BellRing,
            },
            {
              key: "hubNotificationDefault" as const,
              label: "Hubs",
              description: "Base rule for a newly joined hub.",
              icon: Layers3,
            },
            {
              key: "lobbyNotificationDefault" as const,
              label: "Lobbies",
              description: "Fallback for lobby-level overrides.",
              icon: Volume2,
            },
          ].map((item) => (
            <CompactListRow key={item.key} className="gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-white/[0.04] text-[var(--accent)]">
                <item.icon size={16} strokeWidth={1.5} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white">{item.label}</p>
                <p className="text-xs text-[var(--text-muted)]">{item.description}</p>
              </div>
              <SelectField
                className="text-sm"
                shellClassName="w-full max-w-[220px]"
                value={defaults[item.key]}
                onChange={(event) =>
                  setDefaults((current) => ({
                    ...current,
                    [item.key]: event.target.value as NotificationSetting,
                  }))
                }
              >
                {notificationOptions.map((option) => (
                  <option key={option} value={option}>
                    {notificationLabels[option]}
                  </option>
                ))}
              </SelectField>
            </CompactListRow>
          ))}
        </CompactList>

        <div className="flex flex-wrap gap-2 border-t border-[var(--border-soft)] px-4 py-3">
          <Button onClick={() => void saveDefaults()} disabled={isSavingDefaults} className="h-10">
            {isSavingDefaults ? "Saving..." : "Save defaults"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.refresh()}
            className="h-10"
          >
            Refresh
          </Button>
        </div>
      </section>

      <section className="premium-panel overflow-hidden rounded-[22px]">
        <CompactListHeader className="border-b border-[var(--border-soft)] px-4 py-3">
          <span>Hub rules</span>
          <CompactListCount>{initialSettings.hubs.length}</CompactListCount>
        </CompactListHeader>

        {initialSettings.hubs.length === 0 ? (
          <EmptyState
            title="No joined hubs"
            description="Hub-level notification rules appear after you join a space."
            className="min-h-[160px]"
          />
        ) : (
          <CompactList>
            {initialSettings.hubs.map((hub) => (
              <CompactListRow key={hub.hubId} compact className="gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-white">{hub.hubName}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    Base rule for channels inside this hub.
                  </p>
                </div>
                <SelectField
                  className="text-sm"
                  shellClassName="w-full max-w-[220px]"
                  defaultValue={hub.setting}
                  onChange={(event) =>
                    void updateHubSetting(hub.hubId, event.target.value as NotificationSetting)
                  }
                >
                  {notificationOptions.map((option) => (
                    <option key={option} value={option}>
                      {notificationLabels[option]}
                    </option>
                  ))}
                </SelectField>
              </CompactListRow>
            ))}
          </CompactList>
        )}
      </section>

      <section className="premium-panel overflow-hidden rounded-[22px]">
        <CompactListHeader className="border-b border-[var(--border-soft)] px-4 py-3">
          <span>Lobby overrides</span>
          <CompactListCount>{initialSettings.lobbies.length}</CompactListCount>
        </CompactListHeader>

        {initialSettings.lobbies.length === 0 ? (
          <EmptyState
            title="No lobby overrides yet"
            description="Lobby-specific rules appear after you join hubs with accessible spaces."
            className="min-h-[160px]"
          />
        ) : (
          <CompactList>
            {initialSettings.lobbies.map((lobby) => (
              <CompactListRow key={lobby.lobbyId} compact className="gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-white">
                    {lobby.hubName} / {lobby.lobbyName}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {lobby.inherited
                      ? "Currently inheriting the hub rule."
                      : "This lobby has its own override."}
                  </p>
                </div>
                <SelectField
                  className="text-sm"
                  shellClassName="w-full max-w-[220px]"
                  defaultValue={lobby.setting}
                  onChange={(event) =>
                    void updateLobbySetting(
                      lobby.hubId,
                      lobby.lobbyId,
                      event.target.value as NotificationSetting,
                    )
                  }
                >
                  {notificationOptions.map((option) => (
                    <option key={option} value={option}>
                      {notificationLabels[option]}
                    </option>
                  ))}
                </SelectField>
              </CompactListRow>
            ))}
          </CompactList>
        )}

        <div className="border-t border-[var(--border-soft)] px-4 py-3 text-sm text-[var(--text-dim)]">
          <span className="inline-flex items-center gap-2 text-white">
            <Sparkles size={16} strokeWidth={1.5} className="text-[var(--accent)]" />
            DM, hub, and lobby rules can stay independent without bloating the UI.
          </span>
        </div>
      </section>

      {error ? <p className="text-sm text-rose-200">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-200">{message}</p> : null}
    </div>
  );
}
