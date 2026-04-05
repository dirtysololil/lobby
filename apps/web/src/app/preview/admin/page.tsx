"use client";

import { UsersAdminPanel } from "@/components/admin/users-admin-panel";
import { PreviewShell } from "../_preview-shell";
import { previewAdminUsers, previewViewer } from "../_mock-data";

export default function PreviewAdminPage() {
  return (
    <PreviewShell
      viewer={previewViewer}
      sectionLabel="Админка"
      rows={[
        { id: "overview", label: "Обзор", detail: "Метрики платформы", initials: "Об" },
        { id: "users", label: "Пользователи", detail: "Модерация", active: true, initials: "По" },
        { id: "invites", label: "Инвайты", detail: "Каналы доступа", initials: "Ин" },
        { id: "audit", label: "Аудит", detail: "Последние действия", initials: "Ау" },
      ]}
    >
      <div className="px-4 py-4">
        <UsersAdminPanel
          viewer={previewViewer}
          response={previewAdminUsers}
          filters={{ query: "", role: "", blocked: "all", page: 1 }}
        />
      </div>
    </PreviewShell>
  );
}
