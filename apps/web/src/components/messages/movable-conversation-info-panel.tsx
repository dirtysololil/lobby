"use client";

import type { DmNotificationSetting, DmRetentionMode, PublicUser } from "@lobby/shared";
import { Grip, RotateCcw, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { PresenceIndicator } from "@/components/ui/presence-indicator";
import { UserAvatar } from "@/components/ui/user-avatar";
import { dmNotificationLabels, dmRetentionLabels } from "@/lib/ui-labels";
import { ConversationSettings } from "./conversation-settings";

interface MovableConversationInfoPanelProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  conversationId: string;
  counterpart: PublicUser;
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

type Point = { x: number; y: number };

const panelStorageKey = "lobby:dm-info-panel:v1";
const panelMargin = 16;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function readStoredRatios(): Point | null {
  try {
    const rawValue = window.localStorage.getItem(panelStorageKey);
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as Partial<Point> | null;
    if (!parsed || typeof parsed.x !== "number" || typeof parsed.y !== "number") {
      return null;
    }

    return {
      x: clamp(parsed.x, 0, 1),
      y: clamp(parsed.y, 0, 1),
    };
  } catch {
    return null;
  }
}

function writeStoredRatios(nextValue: Point) {
  try {
    window.localStorage.setItem(panelStorageKey, JSON.stringify(nextValue));
  } catch {
    // Ignore storage failures for local-only UI preference.
  }
}

export function MovableConversationInfoPanel({
  containerRef,
  conversationId,
  counterpart,
  isOpen,
  notificationSetting,
  retentionMode,
  retentionSeconds,
  onClose,
  onSave,
}: MovableConversationInfoPanelProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const dragStartRef = useRef<{
    origin: Point;
    pointer: Point;
  } | null>(null);
  const boundsRef = useRef({
    minX: panelMargin,
    minY: panelMargin,
    maxX: panelMargin,
    maxY: panelMargin,
  });
  const [position, setPosition] = useState<Point>({ x: panelMargin, y: panelMargin });
  const [ready, setReady] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const defaultPosition = useCallback(() => {
    const { minX, minY, maxX, maxY } = boundsRef.current;

    return {
      x: clamp(maxX, minX, maxX),
      y: clamp(maxY, minY, maxY),
    };
  }, []);

  const clampPosition = useCallback((nextValue: Point) => {
    const { minX, minY, maxX, maxY } = boundsRef.current;
    return {
      x: clamp(nextValue.x, minX, maxX),
      y: clamp(nextValue.y, minY, maxY),
    };
  }, []);

  const syncBounds = useCallback(() => {
    const container = containerRef.current;
    const panel = panelRef.current;

    if (!container || !panel) {
      return;
    }

    const maxX = Math.max(panelMargin, container.clientWidth - panel.offsetWidth - panelMargin);
    const maxY = Math.max(panelMargin, container.clientHeight - panel.offsetHeight - panelMargin);
    boundsRef.current = {
      minX: panelMargin,
      minY: panelMargin,
      maxX,
      maxY,
    };

    const storedRatios = readStoredRatios();

    if (!ready) {
      const nextPosition = storedRatios
        ? clampPosition({
            x: panelMargin + storedRatios.x * (maxX - panelMargin),
            y: panelMargin + storedRatios.y * (maxY - panelMargin),
          })
        : defaultPosition();

      setPosition(nextPosition);
      setReady(true);
      return;
    }

    setPosition((current) => clampPosition(current));
  }, [clampPosition, containerRef, defaultPosition, ready]);

  useEffect(() => {
    if (!ready) {
      return;
    }

    const { minX, minY, maxX, maxY } = boundsRef.current;
    const xRange = Math.max(1, maxX - minX);
    const yRange = Math.max(1, maxY - minY);

    writeStoredRatios({
      x: clamp((position.x - minX) / xRange, 0, 1),
      y: clamp((position.y - minY) / yRange, 0, 1),
    });
  }, [position, ready]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      syncBounds();
    });

    const container = containerRef.current;
    const panel = panelRef.current;

    if (!container || !panel || typeof ResizeObserver === "undefined") {
      return () => {
        window.cancelAnimationFrame(frame);
      };
    }

    const resizeObserver = new ResizeObserver(() => {
      syncBounds();
    });

    resizeObserver.observe(container);
    resizeObserver.observe(panel);

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
    };
  }, [containerRef, conversationId, syncBounds]);

  useEffect(() => {
    if (!isDragging) {
      return;
    }

    function handlePointerMove(event: PointerEvent) {
      const dragStart = dragStartRef.current;
      if (!dragStart) {
        return;
      }

      setPosition(
        clampPosition({
          x: dragStart.origin.x + (event.clientX - dragStart.pointer.x),
          y: dragStart.origin.y + (event.clientY - dragStart.pointer.y),
        }),
      );
    }

    function handlePointerUp() {
      dragStartRef.current = null;
      setIsDragging(false);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [clampPosition, isDragging]);

  const metaChips = useMemo(
    () => [
      dmNotificationLabels[notificationSetting],
      dmRetentionLabels[retentionMode],
    ],
    [notificationSetting, retentionMode],
  );

  if (!isOpen) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-0 hidden md:block 2xl:hidden">
      <div
        ref={panelRef}
        className="pointer-events-auto absolute w-[min(320px,calc(100%-1.5rem))] max-w-[320px] rounded-[22px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent_20%),rgba(10,15,23,0.96)] p-3 shadow-[0_24px_60px_rgba(4,8,16,0.34)] backdrop-blur-xl"
        style={{
          transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        }}
      >
        <div
          className="flex items-center justify-between gap-2 rounded-[16px] border border-white/6 bg-white/[0.03] px-2.5 py-2"
          onPointerDown={(event) => {
            if (event.button !== 0) {
              return;
            }

            dragStartRef.current = {
              origin: position,
              pointer: { x: event.clientX, y: event.clientY },
            };
            setIsDragging(true);
          }}
          style={{ touchAction: "none", cursor: isDragging ? "grabbing" : "grab" }}
        >
          <div className="inline-flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-[12px] border border-white/6 bg-black/20 text-[var(--text-muted)]">
              <Grip className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-medium text-white">О диалоге</p>
              <p className="text-xs text-[var(--text-muted)]">
                Перетащите панель в удобное место
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2.5 text-[var(--text-muted)]"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => setPosition(defaultPosition())}
            >
              <RotateCcw className="h-4 w-4" />
              Сброс
            </Button>
            {onClose ? (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 px-0 text-[var(--text-muted)]"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={onClose}
                aria-label="Закрыть панель"
                title="Закрыть панель"
              >
                <X className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3 rounded-[18px] border border-white/6 bg-white/[0.03] px-3 py-2.5">
          <UserAvatar user={counterpart} size="md" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-medium text-white">
                {counterpart.profile.displayName}
              </p>
              <PresenceIndicator user={counterpart} compact />
            </div>
            <p className="truncate text-xs text-[var(--text-muted)]">@{counterpart.username}</p>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {metaChips.map((item) => (
            <span key={item} className="status-pill">
              {item}
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
  );
}
