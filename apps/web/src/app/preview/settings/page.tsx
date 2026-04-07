"use client";

import { ProfileSettingsForm } from "@/components/settings/profile-settings-form";
import { PreviewShell } from "../_preview-shell";
import { previewViewer } from "../_mock-data";

export default function PreviewSettingsPage() {
  return (
    <PreviewShell
      viewer={previewViewer}
      sectionLabel="Settings"
      rows={[
        {
          id: "profile",
          label: "Profile",
          detail: "Identity and avatar",
          active: true,
          initials: "Pr",
        },
        {
          id: "notifications",
          label: "Notifications",
          detail: "Messages and mentions",
          initials: "Nt",
        },
      ]}
    >
      <div className="px-4 py-4">
        <ProfileSettingsForm
          viewer={previewViewer}
          maxAvatarMb={10}
          maxAvatarAnimationMs={15000}
          maxRingtoneMb={25}
        />
      </div>
    </PreviewShell>
  );
}
