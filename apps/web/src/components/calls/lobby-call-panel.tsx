"use client";

import {
  callResponseSchema,
  callStateResponseSchema,
  type CallStateResponse,
  type CallSummary,
} from "@lobby/shared";
import { Clock3, Mic, Phone, PhoneCall, Users2, Waves } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CompactList,
  CompactListCount,
  CompactListRow,
} from "@/components/ui/compact-list";
import { Button } from "@/components/ui/button";
import { PresenceIndicator } from "@/components/ui/presence-indicator";
import { UserAvatar } from "@/components/ui/user-avatar";
import { apiClientFetch } from "@/lib/api-client";
import {
  callModeLabels,
  callParticipantStateLabels,
  callStatusLabels,
} from "@/lib/ui-labels";
import { LiveKitCallRoom } from "./livekit-call-room";
import { useRealtime } from "../realtime/realtime-provider";
import { useCallSession } from "./call-session-provider";

interface LobbyCallPanelProps {
  hubId: string;
  hubName: string;
  lobbyId: string;
  lobbyName: string;
  isViewerMuted: boolean;
}

const iconProps = { size: 16, strokeWidth: 1.5 } as const;

export function LobbyCallPanel({
  hubId,
  hubName,
  lobbyId,
  lobbyName,
  isViewerMuted,
}: LobbyCallPanelProps) {
  const { socket, latestSignal } = useRealtime();
  const { connectToCall, dismissCall, isActiveCall, leaveCall, syncCall } =
    useCallSession();
  const [state, setState] = useState<CallStateResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const callRoute = `/app/hubs/${hubId}/lobbies/${lobbyId}`;
  const callTitle = lobbyName;
  const callSubtitle = `${hubName} · голосовая комната`;

  const connectToResolvedCall = useCallback(
    async (call: CallSummary) => {
      await connectToCall({
        callId: call.id,
        scope: "HUB_LOBBY",
        route: callRoute,
        title: callTitle,
        subtitle: callSubtitle,
        call,
      });
    },
    [callRoute, callSubtitle, callTitle, connectToCall],
  );

  const loadState = useCallback(async () => {
    try {
      const payload = await apiClientFetch(`/v1/calls/hubs/${hubId}/lobbies/${lobbyId}`);
      const parsed = callStateResponseSchema.parse(payload);
      setState(parsed);

      if (parsed.activeCall) {
        syncCall(parsed.activeCall, {
          route: callRoute,
          title: callTitle,
          subtitle: callSubtitle,
        });
      }

      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Не удалось загрузить голосовую комнату.",
      );
    }
  }, [callRoute, callSubtitle, callTitle, hubId, lobbyId, syncCall]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  useEffect(() => {
    if (!socket) {
      return;
    }

    const currentSocket = socket;

    function subscribe() {
      currentSocket.emit("calls.subscribe_lobby", { hubId, lobbyId });
    }

    subscribe();
    currentSocket.on("connect", subscribe);

    return () => {
      currentSocket.off("connect", subscribe);
    };
  }, [hubId, lobbyId, socket]);

  useEffect(() => {
    if (latestSignal?.call.lobbyId !== lobbyId) {
      return;
    }

    if (["DECLINED", "ENDED", "MISSED"].includes(latestSignal.call.status)) {
      dismissCall(latestSignal.call.id);
    }

    void loadState();
  }, [dismissCall, latestSignal, lobbyId, loadState]);

  async function startCall() {
    setPendingAction("start");

    try {
      const payload = await apiClientFetch(
        `/v1/calls/hubs/${hubId}/lobbies/${lobbyId}/start`,
        { method: "POST" },
      );

      const parsed = callResponseSchema.parse(payload);
      await connectToResolvedCall(parsed.call);
      await loadState();
    } finally {
      setPendingAction(null);
    }
  }

  async function joinCall() {
    if (!state?.activeCall) {
      return;
    }

    setPendingAction("join");

    try {
      await connectToResolvedCall(state.activeCall);
      await loadState();
    } finally {
      setPendingAction(null);
    }
  }

  async function leaveLobbyCall() {
    if (!state?.activeCall) {
      return;
    }

    setPendingAction("leave");

    try {
      await leaveCall(state.activeCall.id);
      await loadState();
    } finally {
      setPendingAction(null);
    }
  }

  const activeCall = state?.activeCall ?? null;
  const activeParticipants =
    activeCall?.participants.filter((participant) =>
      ["ACCEPTED", "JOINED"].includes(participant.state),
    ).length ?? 0;
  const isCurrentSession = isActiveCall(activeCall?.id ?? null);
  const summaryLabel = !activeCall
    ? `Голосовая комната ${lobbyName}`
    : isCurrentSession
      ? "Вы уже в голосовой комнате"
      : "Голосовая комната открыта";
  const helperText = errorMessage
    ? errorMessage
    : isViewerMuted
      ? "Для этого аккаунта доступно только прослушивание: микрофон, камера и экран не публикуются."
      : `${hubName} · голосовой лобби-канал`;
  const helperToneClassName = errorMessage
    ? "text-rose-200"
    : isViewerMuted
      ? "text-amber-100"
      : "text-[var(--text-dim)]";
  const metrics = useMemo(
    () => [
      {
        label: "На связи",
        value: `${activeParticipants}`,
      },
      {
        label: "Сеансы",
        value: `${state?.history.length ?? 0}`,
      },
      {
        label: "Режим",
        value: activeCall ? callModeLabels[activeCall.mode] : "Готова к запуску",
      },
    ],
    [activeCall, activeParticipants, state?.history.length],
  );
  const recentCalls = useMemo(
    () =>
      (state?.history ?? [])
        .filter((call) => call.id !== activeCall?.id)
        .slice(0, 4),
    [activeCall?.id, state?.history],
  );
  const currentParticipants = useMemo(
    () =>
      activeCall?.participants.filter((participant) =>
        ["ACCEPTED", "JOINED"].includes(participant.state),
      ) ?? [],
    [activeCall?.participants],
  );

  function formatHistoryDate(call: CallSummary) {
    return new Date(call.endedAt ?? call.acceptedAt ?? call.createdAt).toLocaleString(
      "ru-RU",
      {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      },
    );
  }

  return (
    <div className="grid gap-2.5">
      <section className="premium-panel rounded-[22px] px-3 py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="call-summary-leading">
            <div className="call-summary-icon">
              {isCurrentSession ? <Waves {...iconProps} /> : <PhoneCall {...iconProps} />}
            </div>

            <div className="call-summary-body">
              <p className="call-summary-title text-sm font-medium tracking-tight text-white">
                <span className="truncate">{summaryLabel}</span>
              </p>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="eyebrow-pill">
                  <Mic className="h-3.5 w-3.5" />
                  Голос
                </span>
                <span className="status-pill">
                  {activeCall ? callStatusLabels[activeCall.status] : "Готова"}
                </span>
                {activeCall ? (
                  <span className="status-pill">{callModeLabels[activeCall.mode]}</span>
                ) : null}
                <span className="status-pill">
                  <Users2 {...iconProps} />
                  {activeParticipants}
                </span>
                {isCurrentSession ? <span className="status-pill">Закреплена</span> : null}
              </div>

              <p className={`text-sm ${helperToneClassName}`}>{helperText}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 rounded-[18px] border border-white/6 bg-white/[0.03] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            {!activeCall ? (
              <Button size="sm" onClick={() => void startCall()} disabled={pendingAction !== null}>
                <Phone {...iconProps} />
                {pendingAction === "start" ? "Запускаем..." : "Открыть комнату"}
              </Button>
            ) : (
              <>
                <Button
                  size="sm"
                  onClick={() => void joinCall()}
                  disabled={pendingAction !== null}
                >
                  <Users2 {...iconProps} />
                  {pendingAction === "join"
                    ? "Подключаем..."
                    : isCurrentSession
                      ? "Вернуться к сцене"
                      : "Подключиться"}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="call-danger-button"
                  onClick={() => void leaveLobbyCall()}
                  disabled={pendingAction !== null}
                >
                  {pendingAction === "leave" ? "Выходим..." : "Выйти"}
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {metrics.map((metric) => (
            <div key={metric.label} className="surface-subtle rounded-[16px] px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
                {metric.label}
              </p>
              <p className="mt-1 text-sm font-medium text-white">{metric.value}</p>
            </div>
          ))}
        </div>
      </section>

      {activeCall ? (
        <LiveKitCallRoom
          callId={activeCall.id}
          title="Голосовая сцена"
          description="Комната остаётся доступной между переходами и продолжает жить через call dock."
        />
      ) : (
        <section className="premium-panel rounded-[22px] p-4">
          <div className="compact-toolbar gap-3">
            <div>
              <p className="section-kicker">Комната готова</p>
              <p className="mt-2 text-sm text-[var(--text-dim)]">
                Как только кто-то откроет комнату, сцена появится здесь без переходов в отдельный экран.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <div className="surface-subtle rounded-[16px] px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
                Подключение
              </p>
              <p className="mt-1 text-sm font-medium text-white">
                В один клик из этого лобби
              </p>
            </div>
            <div className="surface-subtle rounded-[16px] px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
                Возврат
              </p>
              <p className="mt-1 text-sm font-medium text-white">
                Через закреплённый call dock
              </p>
            </div>
            <div className="surface-subtle rounded-[16px] px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
                Режим
              </p>
              <p className="mt-1 text-sm font-medium text-white">
                {isViewerMuted ? "Только прослушивание" : "Свободный вход"}
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="premium-panel overflow-hidden rounded-[22px]">
        <div className="px-4 py-3.5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium tracking-tight text-white">
              Участники сейчас
            </p>
            <CompactListCount>{currentParticipants.length}</CompactListCount>
          </div>
        </div>

        {currentParticipants.length === 0 ? (
          <div className="px-4 pb-4 text-sm text-[var(--text-dim)]">
            Комната свободна. Откройте её, чтобы пригласить людей в созвон.
          </div>
        ) : (
          <CompactList>
            {currentParticipants.map((participant) => (
              <CompactListRow key={participant.user.id} compact className="gap-3">
                <UserAvatar user={participant.user} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-white">
                      {participant.user.profile.displayName}
                    </p>
                    <PresenceIndicator user={participant.user} compact />
                  </div>
                  <p className="truncate text-xs text-[var(--text-muted)]">
                    @{participant.user.username} ·{" "}
                    {callParticipantStateLabels[participant.state]}
                  </p>
                </div>
              </CompactListRow>
            ))}
          </CompactList>
        )}
      </section>

      <section className="premium-panel overflow-hidden rounded-[22px]">
        <div className="px-4 py-3.5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium tracking-tight text-white">
              Недавняя активность
            </p>
            <CompactListCount>{recentCalls.length}</CompactListCount>
          </div>
        </div>

        {recentCalls.length === 0 ? (
          <div className="px-4 pb-4 text-sm text-[var(--text-dim)]">
            История появится после первых звонков в этом лобби.
          </div>
        ) : (
          <CompactList>
            {recentCalls.map((call) => (
              <CompactListRow key={call.id} compact className="gap-3">
                <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] border border-white/8 bg-white/[0.04] text-[var(--accent)]">
                  <Clock3 className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">
                    {call.initiatedBy.profile.displayName}
                  </p>
                  <p className="truncate text-xs text-[var(--text-muted)]">
                    {callStatusLabels[call.status]} · {formatHistoryDate(call)}
                  </p>
                </div>
                <span className="glass-badge">{callModeLabels[call.mode]}</span>
              </CompactListRow>
            ))}
          </CompactList>
        )}
      </section>
    </div>
  );
}
