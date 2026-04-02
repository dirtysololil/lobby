"use client";

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

const notificationOptions: NotificationSetting[] = ["ALL", "MENTIONS_ONLY", "MUTED", "OFF"];

export function NotificationSettingsForm({ initialSettings }: NotificationSettingsFormProps) {
  const router = useRouter();
  const [defaults, setDefaults] = useState<UpdateViewerNotificationDefaultsInput>(initialSettings.defaults);
  const [isSavingDefaults, setIsSavingDefaults] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function saveDefaults() {
    setError(null);
    setMessage(null);
    setIsSavingDefaults(true);

    try {
      await apiClientFetch<UserNotificationSettingsResponse>("/v1/users/me/notification-settings", {
        method: "PATCH",
        body: JSON.stringify(defaults),
      });
      setMessage("Default notification settings saved.");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Save failed");
    } finally {
      setIsSavingDefaults(false);
    }
  }

  async function updateHubSetting(hubId: string, notificationSetting: NotificationSetting) {
    setError(null);
    setMessage(null);

    try {
      await apiClientFetch<HubNotificationSettingResponse>(`/v1/hubs/${hubId}/notification-settings`, {
        method: "PATCH",
        body: JSON.stringify({ notificationSetting }),
      });
      setMessage("Hub notification setting updated.");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Hub save failed");
    }
  }

  async function updateLobbySetting(hubId: string, lobbyId: string, notificationSetting: NotificationSetting) {
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
      setMessage("Lobby notification setting updated.");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Lobby save failed");
    }
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 shadow-[var(--shadow)] backdrop-blur-xl">
        <p className="font-mono text-xs uppercase tracking-[0.26em] text-sky-200/70">Defaults</p>
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {[
            {
              key: "dmNotificationDefault" as const,
              label: "DM default",
              description: "Applies to new direct conversations. Existing DMs keep their own setting.",
            },
            {
              key: "hubNotificationDefault" as const,
              label: "Hub default",
              description: "Applies when you join or create a new hub.",
            },
            {
              key: "lobbyNotificationDefault" as const,
              label: "Lobby fallback",
              description: "Used when a lobby has no explicit override.",
            },
          ].map((item) => (
            <div key={item.key} className="rounded-3xl border border-white/10 bg-slate-950/35 p-5">
              <p className="text-sm font-medium text-white">{item.label}</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">{item.description}</p>
              <select
                className="mt-4 h-12 w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 text-sm text-white outline-none"
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
                    {option}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
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

      <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 shadow-[var(--shadow)] backdrop-blur-xl">
        <p className="font-mono text-xs uppercase tracking-[0.26em] text-sky-200/70">Joined hubs</p>
        <div className="mt-6 grid gap-4">
          {initialSettings.hubs.length === 0 ? (
            <EmptyState
              title="No joined hubs"
              description="Join or create a hub first. Hub-level notification overrides will appear here."
            />
          ) : (
            initialSettings.hubs.map((hub) => (
              <div
                key={hub.hubId}
                className="grid gap-4 rounded-3xl border border-white/10 bg-slate-950/35 p-5 lg:grid-cols-[1fr_220px]"
              >
                <div>
                  <p className="text-base font-medium text-white">{hub.hubName}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Hub-level notifications used as fallback for its lobbies.
                  </p>
                </div>
                <div className="flex gap-3">
                  <select
                    className="h-12 flex-1 rounded-2xl border border-white/10 bg-slate-950/50 px-4 text-sm text-white outline-none"
                    defaultValue={hub.setting}
                    onChange={(event) =>
                      void updateHubSetting(hub.hubId, event.target.value as NotificationSetting)
                    }
                  >
                    {notificationOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 shadow-[var(--shadow)] backdrop-blur-xl">
        <p className="font-mono text-xs uppercase tracking-[0.26em] text-sky-200/70">Lobby overrides</p>
        <div className="mt-6 grid gap-4">
          {initialSettings.lobbies.length === 0 ? (
            <EmptyState
              title="No accessible lobbies"
              description="Lobby-specific overrides appear once you have access to at least one hub lobby."
            />
          ) : (
            initialSettings.lobbies.map((lobby) => (
              <div
                key={lobby.lobbyId}
                className="grid gap-4 rounded-3xl border border-white/10 bg-slate-950/35 p-5 lg:grid-cols-[1fr_240px]"
              >
                <div>
                  <p className="text-base font-medium text-white">
                    {lobby.hubName} / {lobby.lobbyName}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    {lobby.inherited ? "Currently inherits hub/default setting." : "Explicit lobby override is active."}
                  </p>
                </div>
                <select
                  className="h-12 rounded-2xl border border-white/10 bg-slate-950/50 px-4 text-sm text-white outline-none"
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
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
