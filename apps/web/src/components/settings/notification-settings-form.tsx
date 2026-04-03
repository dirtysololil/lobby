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
  ALL: "Все события",
  MENTIONS_ONLY: "Только упоминания",
  MUTED: "Без звука",
  OFF: "Отключено",
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
      setMessage("Базовые правила уведомлений сохранены.");
      router.refresh();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Не удалось сохранить настройки",
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
      setMessage("Правило уведомлений для хаба обновлено.");
      router.refresh();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Не удалось сохранить правило хаба",
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
      setMessage("Правило уведомлений для лобби обновлено.");
      router.refresh();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Не удалось сохранить правило лобби",
      );
    }
  }

  return (
    <div className="grid gap-6">
      <section className="premium-panel rounded-[32px] p-6 lg:p-8">
        <p className="section-kicker">Базовые правила</p>
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {[
            {
              key: "dmNotificationDefault" as const,
              label: "Личные диалоги",
              description:
                "Применяется к новым личным диалогам. У существующих чатов может быть собственное правило.",
              icon: BellRing,
            },
            {
              key: "hubNotificationDefault" as const,
              label: "Хабы",
              description:
                "Работает при вступлении в новый хаб или создании собственного пространства.",
              icon: Layers3,
            },
            {
              key: "lobbyNotificationDefault" as const,
              label: "Лобби",
              description:
                "Используется как fallback, если у конкретного лобби нет собственного переопределения.",
              icon: Volume2,
            },
          ].map((item) => (
            <div key={item.key} className="surface-subtle rounded-[26px] p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-white/[0.05] text-[var(--accent)]">
                <item.icon className="h-5 w-5" />
              </div>
              <p className="mt-4 text-sm font-medium text-white">
                {item.label}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-400">
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
        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            onClick={() => void saveDefaults()}
            disabled={isSavingDefaults}
          >
            {isSavingDefaults ? "Сохраняем..." : "Сохранить базовые правила"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.refresh()}
          >
            Обновить
          </Button>
        </div>
        {error ? <p className="mt-4 text-sm text-rose-200">{error}</p> : null}
        {message ? (
          <p className="mt-4 text-sm text-emerald-200">{message}</p>
        ) : null}
      </section>

      <section className="premium-panel rounded-[32px] p-6 lg:p-8">
        <p className="section-kicker">Хабы</p>
        <div className="mt-6 grid gap-4">
          {initialSettings.hubs.length === 0 ? (
            <EmptyState
              title="Нет подключённых хабов"
              description="Вступите в хаб или создайте собственный. После этого здесь появятся override-настройки для каждого пространства."
            />
          ) : (
            initialSettings.hubs.map((hub) => (
              <div
                key={hub.hubId}
                className="list-row grid gap-4 rounded-[28px] p-5 lg:grid-cols-[1fr_220px]"
              >
                <div>
                  <p className="text-base font-medium text-white">
                    {hub.hubName}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Правило хаба выступает fallback-настройкой для всех лобби
                    внутри этого пространства.
                  </p>
                </div>
                <div className="flex gap-3">
                  <select
                    className="field-select flex-1 text-sm"
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
              </div>
            ))
          )}
        </div>
      </section>

      <section className="premium-panel rounded-[32px] p-6 lg:p-8">
        <p className="section-kicker">Переопределения лобби</p>
        <div className="mt-6 grid gap-4">
          {initialSettings.lobbies.length === 0 ? (
            <EmptyState
              title="Нет доступных лобби"
              description="Индивидуальные правила лобби появляются, когда у вас есть доступ хотя бы к одному пространству внутри хаба."
            />
          ) : (
            initialSettings.lobbies.map((lobby) => (
              <div
                key={lobby.lobbyId}
                className="list-row grid gap-4 rounded-[28px] p-5 lg:grid-cols-[1fr_240px]"
              >
                <div>
                  <p className="text-base font-medium text-white">
                    {lobby.hubName} / {lobby.lobbyName}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    {lobby.inherited
                      ? "Сейчас наследует правило хаба или дефолтную настройку."
                      : "Для лобби задано отдельное правило уведомлений."}
                  </p>
                </div>
                <select
                  className="field-select text-sm"
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
        <div className="surface-subtle mt-6 rounded-[24px] p-4 text-sm leading-7 text-[var(--text-dim)]">
          <span className="inline-flex items-center gap-2 text-white">
            <Sparkles className="h-4 w-4 text-[var(--accent)]" />
            Умный шум-контроль
          </span>
          <p className="mt-2">
            Система уведомлений в Lobby разделяет уровни сигнала: личные
            диалоги, хабы и лобби настраиваются независимо, чтобы продукт
            оставался живым, но не шумным.
          </p>
        </div>
      </section>
    </div>
  );
}
