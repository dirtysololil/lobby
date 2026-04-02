import type { AdminAuditLogListResponse } from "@lobby/shared";
import { EmptyState } from "@/components/ui/empty-state";

interface AuditLogPanelProps {
  response: AdminAuditLogListResponse;
}

export function AuditLogPanel({ response }: AuditLogPanelProps) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 shadow-[var(--shadow)] backdrop-blur-xl">
      <p className="font-mono text-xs uppercase tracking-[0.26em] text-sky-200/70">Audit entries</p>
      <div className="mt-6 grid gap-4">
        {response.items.length === 0 ? (
          <EmptyState
            title="No audit entries found"
            description="Try loosening the action/entity filters."
          />
        ) : (
          response.items.map((item) => (
            <div key={item.id} className="rounded-3xl border border-white/10 bg-slate-950/35 p-5">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-sky-200/80">
                  {item.entityType}
                </span>
                <p className="text-base font-medium text-white">{item.action}</p>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                {item.actor
                  ? `${item.actor.profile.displayName} (@${item.actor.username})`
                  : "System"}
                {" · "}
                {new Date(item.createdAt).toLocaleString()}
              </p>
              <p className="mt-2 break-all text-xs leading-6 text-slate-500">
                entityId: {item.entityId ?? "n/a"} · ip: {item.ipAddress ?? "n/a"}
              </p>
              {item.metadata ? (
                <pre className="mt-4 overflow-x-auto rounded-3xl border border-white/10 bg-slate-950/60 p-4 text-xs leading-6 text-slate-300">
                  {JSON.stringify(item.metadata, null, 2)}
                </pre>
              ) : null}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
