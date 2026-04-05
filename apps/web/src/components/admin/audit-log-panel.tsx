import type { AdminAuditLogListResponse } from "@lobby/shared";
import { ScrollText, Sparkles } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

const iconProps = { size: 18, strokeWidth: 1.5 } as const;

interface AuditLogPanelProps {
  response: AdminAuditLogListResponse;
}

export function AuditLogPanel({ response }: AuditLogPanelProps) {
  return (
    <section className="premium-panel rounded-[24px] p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
        <div>
          <p className="text-sm font-medium text-white">Поток аудита</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Компактный журнал действий платформы и автоматических событий.
          </p>
        </div>
        <span className="status-pill">
          <ScrollText {...iconProps} />
          {response.items.length} событий
        </span>
      </div>

      <div className="min-h-0 overflow-y-auto">
        {response.items.length === 0 ? (
          <EmptyState
            className="py-10"
            title="Записей аудита не найдено"
            description="Измените фильтры, чтобы показать больше событий."
          />
        ) : (
          response.items.map((item) => (
            <div
              key={item.id}
              className="border-b border-[var(--border-soft)] px-4 py-3 transition-colors hover:bg-[var(--bg-hover)]"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="glass-badge">{item.entityType}</span>
                <p className="text-sm font-medium text-white">{item.action}</p>
              </div>
              <p className="mt-2 text-sm text-[var(--text-dim)]">
                {item.actor
                  ? `${item.actor.profile.displayName} (@${item.actor.username})`
                  : "Система"}{" "}
                / {new Date(item.createdAt).toLocaleString("ru-RU")}
              </p>
              <p className="mt-1 break-all text-xs text-[var(--text-muted)]">
                entityId {item.entityId ?? "н/д"} / ip {item.ipAddress ?? "н/д"}
              </p>
              {item.metadata ? (
                <pre className="mt-3 overflow-x-auto rounded-[16px] border border-[var(--border-soft)] bg-[var(--bg-panel-muted)] p-3 text-xs leading-5 text-[var(--text-soft)]">
                  {JSON.stringify(item.metadata, null, 2)}
                </pre>
              ) : null}
            </div>
          ))
        )}
      </div>

      <div className="px-4 py-3 text-sm text-[var(--text-dim)]">
        <span className="inline-flex items-center gap-2 text-white">
          <Sparkles {...iconProps} className="text-[var(--accent)]" />
          Держите операционный обзор быстрым, прозрачным и рядом с рабочей поверхностью.
        </span>
      </div>
    </section>
  );
}
