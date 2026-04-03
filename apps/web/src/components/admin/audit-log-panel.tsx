import type { AdminAuditLogListResponse } from "@lobby/shared";
import { ScrollText, Sparkles } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

interface AuditLogPanelProps {
  response: AdminAuditLogListResponse;
}

export function AuditLogPanel({ response }: AuditLogPanelProps) {
  return (
    <section className="social-shell rounded-[20px] p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="section-kicker">Журнал действий</p>
        <span className="status-pill">
          <ScrollText className="h-3.5 w-3.5 text-[var(--accent)]" />
          Поток аудита
        </span>
      </div>
      <div className="mt-3 grid gap-2">
        {response.items.length === 0 ? (
          <EmptyState
            title="Записей не найдено"
            description="Смягчите фильтры по действию или сущности."
          />
        ) : (
          response.items.map((item) => (
            <div key={item.id} className="list-row rounded-[16px] p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="glass-badge">{item.entityType}</span>
                <p className="text-sm font-medium text-white">
                  {item.action}
                </p>
              </div>
              <p className="mt-2 text-sm text-[var(--text-dim)]">
                {item.actor
                  ? `${item.actor.profile.displayName} (@${item.actor.username})`
                  : "Система"}{" "}
                · {new Date(item.createdAt).toLocaleString()}
              </p>
              <p className="mt-1 break-all text-xs text-[var(--text-muted)]">
                entityId: {item.entityId ?? "n/a"} · ip:{" "}
                {item.ipAddress ?? "n/a"}
              </p>
              {item.metadata ? (
                <pre className="mt-2.5 overflow-x-auto rounded-[14px] border border-[var(--border)] bg-slate-950/65 p-3 text-xs leading-5 text-slate-300">
                  {JSON.stringify(item.metadata, null, 2)}
                </pre>
              ) : null}
            </div>
          ))
        )}
      </div>
      <div className="surface-subtle mt-4 rounded-[16px] px-3 py-2.5 text-sm text-[var(--text-dim)]">
        <span className="inline-flex items-center gap-2 text-white">
          <Sparkles className="h-4 w-4 text-[var(--accent)]" />
          Короткий журнал действий.
        </span>
      </div>
    </section>
  );
}
