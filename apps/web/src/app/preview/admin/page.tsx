"use client";

import { UsersAdminPanel } from "@/components/admin/users-admin-panel";
import { PreviewShell } from "../_preview-shell";
import { previewAdminUsers, previewViewer } from "../_mock-data";

export default function PreviewAdminPage() {
  return (
    <PreviewShell
      viewer={previewViewer}
      sectionLabel="Control"
      rows={[
        { id: "overview", label: "Control", detail: "Platform metrics", initials: "Ct" },
        { id: "users", label: "Users", detail: "Moderation queue", active: true, initials: "Us" },
        { id: "invites", label: "Invites", detail: "Access channels", initials: "Iv" },
        { id: "audit", label: "Audit log", detail: "Recent actions", initials: "Au" },
      ]}
    >
      <div className="px-4 py-4">
        <UsersAdminPanel
          response={previewAdminUsers}
          filters={{ query: "", role: "", blocked: "all", page: 1 }}
        />
      </div>
    </PreviewShell>
  );
}
