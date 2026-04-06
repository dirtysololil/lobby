"use client";

import { LoaderCircle, Trash2, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiClientFetch } from "@/lib/api-client";
import { broadcastHubShellCacheClear } from "@/lib/hub-shell-cache";
import { cn } from "@/lib/utils";

type ActionKey = "audit" | "cache";

type FeedbackState =
  | { tone: "success"; message: string }
  | { tone: "error"; message: string }
  | null;

const actionCopy: Record<
  ActionKey,
  {
    title: string;
    description: string;
    confirmLabel: string;
    loadingLabel: string;
    buttonLabel: string;
    buttonVariant: "secondary" | "destructive";
  }
> = {
  audit: {
    title: "Очистить журнал?",
    description:
      "Будут удалены все audit logs из базы. После очистки останется только запись о самом действии, чтобы не потерять след операции.",
    confirmLabel: "Очистить журнал",
    loadingLabel: "Очищаем журнал...",
    buttonLabel: "Очистить журнал",
    buttonVariant: "destructive",
  },
  cache: {
    title: "Очистить кэш?",
    description:
      "Будет сброшен app cache Lobby во всех открытых вкладках и обновлены данные страницы. Next data cache и Redis session cache в текущем стеке не используются.",
    confirmLabel: "Очистить кэш",
    loadingLabel: "Очищаем кэш...",
    buttonLabel: "Очистить кэш",
    buttonVariant: "secondary",
  },
};

export function AuditAdminActions() {
  const router = useRouter();
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [pendingAction, setPendingAction] = useState<ActionKey | null>(null);
  const [runningAction, setRunningAction] = useState<ActionKey | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    return () => {
      setMounted(false);
    };
  }, []);

  const currentAction = useMemo(
    () => (pendingAction ? actionCopy[pendingAction] : null),
    [pendingAction],
  );

  async function handleConfirm() {
    if (!pendingAction) {
      return;
    }

    setRunningAction(pendingAction);
    setFeedback(null);

    try {
      if (pendingAction === "audit") {
        await apiClientFetch("/v1/admin/audit/clear", {
          method: "POST",
        });
        setFeedback({
          tone: "success",
          message: "Журнал очищен. Список ниже уже обновлён.",
        });
      } else {
        broadcastHubShellCacheClear();
        setFeedback({
          tone: "success",
          message: "Кэш приложения очищен. Данные страницы обновлены.",
        });
      }

      setPendingAction(null);
      router.refresh();
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Не удалось выполнить действие.",
      });
    } finally {
      setRunningAction(null);
    }
  }

  return (
    <>
      <div className="grid gap-2 sm:grid-cols-2">
        {(["audit", "cache"] as ActionKey[]).map((actionKey) => {
          const item = actionCopy[actionKey];
          const isBusy = runningAction === actionKey;

          return (
            <Button
              key={actionKey}
              type="button"
              variant={item.buttonVariant}
              onClick={() => {
                setFeedback(null);
                setPendingAction(actionKey);
              }}
              disabled={runningAction !== null}
              className="h-10 justify-center rounded-[14px] px-3"
            >
              {isBusy ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              {isBusy ? item.loadingLabel : item.buttonLabel}
            </Button>
          );
        })}
      </div>

      {feedback ? (
        <p
          className={cn(
            "rounded-[14px] border px-3 py-2 text-sm",
            feedback.tone === "success"
              ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-50"
              : "border-rose-300/20 bg-rose-300/10 text-rose-100",
          )}
        >
          {feedback.message}
        </p>
      ) : null}

      {mounted && currentAction
        ? createPortal(
            <div
              className="fixed inset-0 z-[95] flex items-center justify-center bg-[rgba(3,6,12,0.78)] p-4 backdrop-blur-sm"
              onClick={(event) => {
                if (
                  event.target === event.currentTarget &&
                  runningAction === null
                ) {
                  setPendingAction(null);
                }
              }}
              role="presentation"
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="audit-admin-actions-title"
                className="w-full max-w-[440px] rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent_20%),rgba(7,12,18,0.96)] p-5 shadow-[0_30px_100px_rgba(2,6,12,0.55)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p
                      id="audit-admin-actions-title"
                      className="text-base font-semibold tracking-tight text-white"
                    >
                      {currentAction.title}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[var(--text-dim)]">
                      {currentAction.description}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPendingAction(null)}
                    disabled={runningAction !== null}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/20 text-[var(--text-soft)] transition-colors hover:border-white/16 hover:bg-black/35 hover:text-white disabled:pointer-events-none disabled:opacity-50"
                    aria-label="Закрыть подтверждение"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-5 flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setPendingAction(null)}
                    disabled={runningAction !== null}
                    className="h-10 px-4"
                  >
                    Отмена
                  </Button>
                  <Button
                    type="button"
                    variant={currentAction.buttonVariant}
                    onClick={() => void handleConfirm()}
                    disabled={runningAction !== null}
                    className="h-10 px-4"
                  >
                    {runningAction === pendingAction ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    {runningAction === pendingAction
                      ? currentAction.loadingLabel
                      : currentAction.confirmLabel}
                  </Button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
