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
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
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
        saveError instanceof Error
          ? saveError.message
          : "Unable to update the hub rule.",
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
    <div className="grid gap-4">
      <section className="premium-panel rounded-[24px] p-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="section-kicker">Defaults</p>
            <p className="mt-2 text-sm leading-6 text-[var(--text-dim)]">
              Set the baseline notification behavior for new DMs, hubs and lobbies.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="status-pill">
              <BellRing size={18} strokeWidth={1.5} />
              Communication defaults
            </span>
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          {[
            {
              key: "dmNotificationDefault" as const,
              label: "Direct messages",
              description: "Applied when a brand-new DM thread is opened.",
              icon: BellRing,
            },
            {
              key: "hubNotificationDefault" as const,
              label: "Hubs",
              description: "Baseline rule for a new hub membership.",
              icon: Layers3,
            },
            {
              key: "lobbyNotificationDefault" as const,
              label: "Lobbies",
              description: "Fallback for lobby-level overrides inside a hub.",
              icon: Volume2,
            },
          ].map((item) => (
            <div key={item.key} className="surface-subtle rounded-[20px] p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-white/5 text-[var(--accent)]">
                <item.icon size={18} strokeWidth={1.5} />
              </div>
              <p className="mt-4 text-sm font-medium text-white">{item.label}</p>
              <p className="mt-2 text-sm leading-6 text-[var(--text-dim)]">
                {item.description}
              </p>
              <select
                className="field-select mt-4 text-sm"
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
              </select>
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap gap-2.5">
          <Button onClick={() => void saveDefaults()} disabled={isSavingDefaults}>
            {isSavingDefaults ? "Saving..." : "Save defaults"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => router.refresh()}>
            Refresh
          </Button>
        </div>
        {error ? <p className="mt-4 text-sm text-rose-200">{error}</p> : null}
        {message ? <p className="mt-4 text-sm text-emerald-200">{message}</p> : null}
      </section>

      <section className="premium-panel rounded-[24px] p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="section-kicker">Hub rules</p>
          <span className="status-pill">{initialSettings.hubs.length} hubs</span>
        </div>

        <div className="mt-4 grid gap-2">
          {initialSettings.hubs.length === 0 ? (
            <EmptyState
              title="No joined hubs"
              description="Hub-level notification rules appear once you have access to a hub."
            />
          ) : (
            initialSettings.hubs.map((hub) => (
              <div
                key={hub.hubId}
                className="flex flex-col gap-3 rounded-[18px] border border-white/6 bg-white/[0.02] px-4 py-3 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">{hub.hubName}</p>
                  <p className="mt-1 text-sm text-[var(--text-dim)]">
                    Base rule for spaces inside this hub.
                  </p>
                </div>
                <select
                  className="field-select max-w-[220px] text-sm"
                  defaultValue={hub.setting}
                  onChange={(event) =>
                    void updateHubSetting(
                      hub.hubId,
                      event.target.value as NotificationSetting,
                    )
                  }
                >
                  {notificationOptions.map((option) => (
                    <option key={option} value={option}>
                      {notificationLabels[option]}
                    </option>
                  ))}
                </select>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="premium-panel rounded-[24px] p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="section-kicker">Lobby overrides</p>
          <span className="status-pill">{initialSettings.lobbies.length} lobbies</span>
        </div>

        <div className="mt-4 grid gap-2">
          {initialSettings.lobbies.length === 0 ? (
            <EmptyState
              title="No lobby overrides yet"
              description="Lobby-specific notification rules appear after you join hubs with accessible spaces."
            />
          ) : (
            initialSettings.lobbies.map((lobby) => (
              <div
                key={lobby.lobbyId}
                className="flex flex-col gap-3 rounded-[18px] border border-white/6 bg-white/[0.02] px-4 py-3 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">
                    {lobby.hubName} / {lobby.lobbyName}
                  </p>
                  <p className="mt-1 text-sm text-[var(--text-dim)]">
                    {lobby.inherited
                      ? "Currently inheriting the hub rule."
                      : "This lobby has its own override."}
                  </p>
                </div>
                <select
                  className="field-select max-w-[220px] text-sm"
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
                </select>
              </div>
            ))
          )}
        </div>

        <div className="surface-subtle mt-5 rounded-[18px] px-4 py-3 text-sm leading-6 text-[var(--text-dim)]">
          <span className="inline-flex items-center gap-2 text-white">
            <Sparkles size={18} strokeWidth={1.5} className="text-[var(--accent)]" />
            DM, hub and lobby rules can be tuned independently.
          </span>
        </div>
      </section>
    </div>
  );
}
