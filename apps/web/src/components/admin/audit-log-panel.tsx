import Link from "next/link";
import type { AdminAuditLogListResponse } from "@lobby/shared";
import { Clock3, ScrollText } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { buildUserProfileHref } from "@/lib/profile-routes";

const iconProps = { size: 18, strokeWidth: 1.5 } as const;

interface AuditLogPanelProps {
  response: AdminAuditLogListResponse;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AuditLogPanel({ response }: AuditLogPanelProps) {
  return (
    <section className="premium-panel flex min-h-0 flex-1 flex-col overflow-hidden rounded-[24px] p-0">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
        <div>
          <p className="text-sm font-medium text-white">РџРѕС‚РѕРє Р°СѓРґРёС‚Р°</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Р›РѕРіРё Р¶РёРІСѓС‚ РІРЅСѓС‚СЂРё РѕС‚РґРµР»СЊРЅРѕРіРѕ viewport, С‡С‚РѕР±С‹ С„РёР»СЊС‚СЂС‹ Рё С…РµРґРµСЂ РѕСЃС‚Р°РІР°Р»РёСЃСЊ РЅР° РјРµСЃС‚Рµ.
          </p>
        </div>
        <span className="status-pill">
          <ScrollText {...iconProps} />
          {response.items.length} СЃРѕР±С‹С‚РёР№
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {response.items.length === 0 ? (
          <EmptyState
            className="py-10"
            title="Р—Р°РїРёСЃРµР№ Р°СѓРґРёС‚Р° РЅРµ РЅР°Р№РґРµРЅРѕ"
            description="РР·РјРµРЅРёС‚Рµ С„РёР»СЊС‚СЂС‹, С‡С‚РѕР±С‹ РїРѕРєР°Р·Р°С‚СЊ Р±РѕР»СЊС€Рµ СЃРѕР±С‹С‚РёР№."
          />
        ) : (
          <div className="grid gap-0">
            {response.items.map((item) => (
              <div
                key={item.id}
                className="border-b border-[var(--border-soft)] px-4 py-3 transition-colors hover:bg-[var(--bg-hover)]"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="glass-badge">{item.entityType}</span>
                  <p className="text-sm font-medium text-white">{item.action}</p>
                  <span className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]">
                    <Clock3 className="h-3.5 w-3.5" />
                    {formatDateTime(item.createdAt)}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[var(--text-dim)]">
                  {item.actor ? (
                    <Link
                      href={buildUserProfileHref(item.actor.username)}
                      className="identity-link rounded-[12px]"
                    >
                      <span className="font-medium text-white">
                        {item.actor.profile.displayName}
                      </span>
                      <span className="text-[var(--text-muted)]">@{item.actor.username}</span>
                    </Link>
                  ) : (
                    <span className="font-medium text-white">РЎРёСЃС‚РµРјР°</span>
                  )}
                  <span className="text-xs text-[var(--text-muted)]">
                    entityId {item.entityId ?? "РЅ/Рґ"} / ip {item.ipAddress ?? "РЅ/Рґ"}
                  </span>
                </div>

                {item.metadata ? (
                  <pre className="mt-3 overflow-x-auto rounded-[16px] border border-[var(--border-soft)] bg-[var(--bg-panel-muted)] p-3 text-xs leading-5 text-[var(--text-soft)]">
                    {JSON.stringify(item.metadata, null, 2)}
                  </pre>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
