import type { AdminAuditLogListResponse } from "@lobby/shared";
import { ScrollText, Sparkles } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

interface AuditLogPanelProps {
  response: AdminAuditLogListResponse;
}

export function AuditLogPanel({ response }: AuditLogPanelProps) {
  return (
    <section className="social-shell rounded-[32px] p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="section-kicker">Журнал действий</p>
        <span className="status-pill">
          <ScrollText className="h-3.5 w-3.5 text-[var(--accent)]" />
          Поток аудита
        </span>
      </div>
      <div className="mt-4 grid gap-3">
        {response.items.length === 0 ? (
          <EmptyState
            title="Записей не найдено"
            description="Смягчите фильтры по действию или сущности."
          />
        ) : (
          response.items.map((item) => (
            <div key={item.id} className="list-row rounded-[26px] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="glass-badge">{item.entityType}</span>
                <p className="text-base font-medium text-white">
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
                <pre className="mt-3 overflow-x-auto rounded-2xl border border-[var(--border)] bg-slate-950/65 p-3 text-xs leading-6 text-slate-300">
                  {JSON.stringify(item.metadata, null, 2)}
                </pre>
              ) : null}
            </div>
          ))
        )}
      </div>
      <div className="surface-subtle mt-5 rounded-[24px] p-4 text-sm leading-7 text-[var(--text-dim)]">
        <span className="inline-flex items-center gap-2 text-white">
          <Sparkles className="h-4 w-4 text-[var(--accent)]" />
          След критичных действий
        </span>
        <p className="mt-2">
          Аудит не должен выглядеть техническим дампом. Это читаемый журнал
          ответственности, который подтверждает управляемость закрытой
          платформы.
        </p>
      </div>
    </section>
  );
}
