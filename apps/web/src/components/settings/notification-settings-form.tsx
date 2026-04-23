"use client";

import { BellRing, Layers3, Volume2 } from "lucide-react";
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
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { CompactListCount, CompactListMeta } from "@/components/ui/compact-list";
import { EmptyState } from "@/components/ui/empty-state";
import { SelectField } from "@/components/ui/select-field";
import { apiClientFetch } from "@/lib/api-client";
import { dispatchNotificationPreferencesEvent } from "@/lib/notification-preferences";

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
  ALL: "Все события",
  MENTIONS_ONLY: "Только упоминания",
  MUTED: "Без звука",
  OFF: "Выключено",
};

const primaryActionClassName =
  "h-10 rounded-[14px] border-white bg-white px-4 text-black hover:border-white hover:bg-neutral-100";

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
      setMessage("Базовые правила сохранены.");
      dispatchNotificationPreferencesEvent({
        scope: "defaults",
        defaults,
      });
      router.refresh();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Не удалось сохранить настройки уведомлений.",
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
      setMessage("Правило для хаба обновлено.");
      router.refresh();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Не удалось обновить правило хаба.",
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
      setMessage("Правило для канала обновлено.");
      router.refresh();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Не удалось обновить правило канала.",
      );
    }
  }

  return (
    <div className="grid gap-3">
      <section className="premium-panel overflow-hidden rounded-[22px]">
        <div className="flex flex-col gap-3 border-b border-[var(--border-soft)] px-4 py-3.5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="section-kicker">По умолчанию</p>
            <h2 className="mt-1 text-sm font-semibold tracking-tight text-white">
              Базовые правила
            </h2>
            <p className="mt-1 text-xs text-[var(--text-dim)]">
              Для новых диалогов, хабов и каналов.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => void saveDefaults()}
              disabled={isSavingDefaults}
              className={primaryActionClassName}
            >
              {isSavingDefaults ? "Сохраняем..." : "Сохранить"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.refresh()}
              className="h-10 rounded-[14px] border-white/8 bg-black px-4 hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)]"
            >
              Обновить
            </Button>
          </div>
        </div>

        <div className="grid gap-2 px-4 py-4">
          {[
            {
              key: "dmNotificationDefault" as const,
              label: "Личные сообщения",
              meta: "Новые диалоги",
              icon: BellRing,
            },
            {
              key: "hubNotificationDefault" as const,
              label: "Хабы",
              meta: "Новые пространства",
              icon: Layers3,
            },
            {
              key: "lobbyNotificationDefault" as const,
              label: "Каналы",
              meta: "Новые каналы",
              icon: Volume2,
            },
          ].map((item) => (
            <div
              key={item.key}
              className="flex flex-wrap items-center gap-3 rounded-[16px] border border-white/8 bg-black px-3 py-2.5"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] border border-[var(--border-soft)] bg-[var(--bg-panel-soft)] text-[var(--text-soft)]">
                <item.icon size={15} strokeWidth={1.5} />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white">{item.label}</p>
                <p className="text-xs text-[var(--text-dim)]">{item.meta}</p>
              </div>

              <SelectField
                className="min-h-10 text-sm"
                shellClassName="min-w-[220px] w-full md:w-[240px]"
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
            </div>
          ))}
        </div>
      </section>

      <CollapsibleSection
        defaultOpen={initialSettings.hubs.length > 0 && initialSettings.hubs.length <= 5}
        kicker="Хабы"
        title="Локальные правила"
        description="Отдельные настройки для пространств"
        summary={<CompactListCount>{initialSettings.hubs.length}</CompactListCount>}
      >
        {initialSettings.hubs.length === 0 ? (
          <div className="rounded-[18px] border border-white/8 bg-black">
            <EmptyState
              title="Нет подключенных хабов"
              description="Правила появятся после вступления в пространство."
              className="min-h-[120px]"
            />
          </div>
        ) : (
          <div className="grid gap-2">
            {initialSettings.hubs.map((hub) => (
              <div
                key={hub.hubId}
                className="flex flex-wrap items-center gap-3 rounded-[16px] border border-white/8 bg-black px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">
                    {hub.hubName}
                  </p>
                  <p className="text-xs text-[var(--text-dim)]">
                    Правило для новых каналов внутри хаба.
                  </p>
                </div>

                <SelectField
                  className="min-h-10 text-sm"
                  shellClassName="min-w-[220px] w-full md:w-[240px]"
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
                </SelectField>
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection
        defaultOpen={initialSettings.lobbies.length > 0 && initialSettings.lobbies.length <= 6}
        kicker="Каналы"
        title="Переопределения"
        description="Индивидуальные правила для конкретных каналов"
        summary={<CompactListCount>{initialSettings.lobbies.length}</CompactListCount>}
      >
        {initialSettings.lobbies.length === 0 ? (
          <div className="rounded-[18px] border border-white/8 bg-black">
            <EmptyState
              title="Переопределений пока нет"
              description="Настройки канала появятся после входа в хабы с доступными пространствами."
              className="min-h-[120px]"
            />
          </div>
        ) : (
          <div className="grid gap-2">
            {initialSettings.lobbies.map((lobby) => (
              <div
                key={lobby.lobbyId}
                className="flex flex-wrap items-center gap-3 rounded-[16px] border border-white/8 bg-black px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium text-white">
                      {lobby.hubName} / {lobby.lobbyName}
                    </p>
                    <CompactListMeta>
                      {lobby.inherited ? "Наследует" : "Локально"}
                    </CompactListMeta>
                  </div>
                </div>

                <SelectField
                  className="min-h-10 text-sm"
                  shellClassName="min-w-[220px] w-full md:w-[240px]"
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
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>

      {error ? <p className="px-1 text-sm text-rose-200">{error}</p> : null}
      {message ? <p className="px-1 text-sm text-emerald-200">{message}</p> : null}
    </div>
  );
}
