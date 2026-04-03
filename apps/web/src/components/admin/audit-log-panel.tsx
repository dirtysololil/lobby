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
          <p className="text-sm font-medium text-white">Audit stream</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            A compact operational record of platform actions and automated events.
          </p>
        </div>
        <span className="status-pill">
          <ScrollText {...iconProps} />
          {response.items.length} events
        </span>
      </div>

      <div className="min-h-0 overflow-y-auto">
        {response.items.length === 0 ? (
          <EmptyState
            className="py-10"
            title="No audit entries found"
            description="Adjust the filters to bring more of the stream into view."
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
                  : "System"}{" "}
                / {new Date(item.createdAt).toLocaleString()}
              </p>
              <p className="mt-1 break-all text-xs text-[var(--text-muted)]">
                entityId {item.entityId ?? "n/a"} / ip {item.ipAddress ?? "n/a"}
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
          Keep operational review fast, searchable and close to the actual surface.
        </span>
      </div>
    </section>
  );
}
