import type { AdminAuditLogListResponse } from "@lobby/shared";
import { EmptyState } from "@/components/ui/empty-state";

interface AuditLogPanelProps { response: AdminAuditLogListResponse; }

export function AuditLogPanel({ response }: AuditLogPanelProps) {
  return (
    <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)]">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-200/70">Журнал действий</p>
      <div className="mt-4 grid gap-3">
        {response.items.length === 0 ? <EmptyState title="Записей не найдено" description="Смягчите фильтры по действию или сущности." /> : response.items.map((item) => (
          <div key={item.id} className="rounded-2xl border border-[var(--border)] bg-slate-950/40 p-4">
            <div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[11px] uppercase tracking-[0.15em] text-cyan-100/80">{item.entityType}</span><p className="text-base font-medium text-white">{item.action}</p></div>
            <p className="mt-2 text-sm text-slate-400">{item.actor ? `${item.actor.profile.displayName} (@${item.actor.username})` : "Система"} · {new Date(item.createdAt).toLocaleString()}</p>
            <p className="mt-1 break-all text-xs text-slate-500">entityId: {item.entityId ?? "n/a"} · ip: {item.ipAddress ?? "n/a"}</p>
            {item.metadata ? <pre className="mt-3 overflow-x-auto rounded-2xl border border-[var(--border)] bg-slate-950/65 p-3 text-xs leading-6 text-slate-300">{JSON.stringify(item.metadata, null, 2)}</pre> : null}
          </div>
        ))}
      </div>
    </section>
  );
}
