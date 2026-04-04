"use client";

import {
  Mic,
  MicOff,
  Monitor,
  PhoneCall,
  PhoneOff,
  Video,
  VideoOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PreviewShell } from "../_preview-shell";
import { previewLeo, previewMira, previewViewer } from "../_mock-data";

const activeContact = previewLeo;

export default function PreviewDmCallPage() {
  return (
    <PreviewShell
      viewer={previewViewer}
      sectionLabel="Conversations"
      rows={[
        {
          id: "r1",
          user: previewMira,
          label: previewMira.profile.displayName,
          detail: "The thread feels a lot denser now.",
        },
        {
          id: "r2",
          user: activeContact,
          label: activeContact.profile.displayName,
          detail: "Screen share is live in this call.",
          active: true,
          meta: (
            <span className="glass-badge">
              <PhoneCall size={18} strokeWidth={1.5} />
              Live
            </span>
          ),
        },
      ]}
    >
      <div className="flex min-h-screen flex-col px-4 py-4">
        <div className="premium-panel rounded-[28px] p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="eyebrow-pill">Call scene</span>
                <span className="status-pill">ACCEPTED</span>
                <span className="status-pill">VIDEO</span>
                <span className="status-pill">
                  <Monitor size={18} strokeWidth={1.5} />
                  Screen share active
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--text-dim)]">
                Audio, camera and screen share stay grouped in a single communication scene.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-[20px] border border-white/6 bg-white/[0.03] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:grid-cols-4">
              <Button size="sm" variant="secondary" className="justify-start">
                <Mic size={18} strokeWidth={1.5} />
                Mic on
              </Button>
              <Button size="sm" variant="secondary" className="justify-start">
                <Video size={18} strokeWidth={1.5} />
                Camera
              </Button>
              <Button size="sm" variant="secondary" className="justify-start">
                <Monitor size={18} strokeWidth={1.5} />
                Share
              </Button>
              <Button size="sm" variant="destructive" className="justify-start">
                <PhoneOff size={18} strokeWidth={1.5} />
                Leave
              </Button>
            </div>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_320px]">
            <div className="space-y-3">
              <div className="relative min-h-[340px] overflow-hidden rounded-[24px] border border-white/6 bg-[radial-gradient(circle_at_top,rgba(106,168,248,0.12),transparent_28%),var(--bg-panel-muted)] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(111,165,215,0.18),transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent_48%)]" />
                <div className="absolute left-6 top-6 rounded-full border border-white/8 bg-black/20 px-3 py-1 text-xs text-[var(--text-soft)]">
                  Leo Hart is sharing screen
                </div>
                <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between gap-3 bg-[linear-gradient(180deg,transparent,rgba(5,8,12,0.82))] px-4 pb-4 pt-10">
                  <div>
                    <p className="text-sm font-medium text-white">Sprint review board</p>
                    <p className="mt-1 text-xs text-[var(--text-soft)]">
                      Remote • Screen share
                    </p>
                  </div>
                  <span className="glass-badge">
                    <Monitor size={18} strokeWidth={1.5} />
                    Share
                  </span>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {[
                  { name: "Leo Hart", meta: "Remote • Camera", muted: false },
                  { name: "You", meta: "Local • Camera off", muted: true },
                ].map((tile) => (
                  <div
                    key={tile.name}
                    className="relative min-h-[180px] overflow-hidden rounded-[20px] border border-white/6 bg-[radial-gradient(circle_at_top,rgba(106,168,248,0.16),transparent_42%),rgba(10,13,18,0.82)]"
                  >
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/8 bg-white/5 text-lg font-semibold text-white">
                        {tile.name === "You" ? "AH" : "LH"}
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium text-white">{tile.name}</p>
                        <p className="mt-1 text-xs text-[var(--text-muted)]">{tile.meta}</p>
                      </div>
                    </div>
                    <div className="absolute bottom-3 right-3">
                      <span className="glass-badge">
                        {tile.muted ? (
                          <MicOff size={18} strokeWidth={1.5} />
                        ) : (
                          <VideoOff size={18} strokeWidth={1.5} />
                        )}
                        {tile.muted ? "Muted" : "Cam off"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="surface-subtle rounded-[22px] p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-white">Participants</p>
                  <span className="text-xs text-[var(--text-muted)]">2 live</span>
                </div>
                <div className="mt-3 grid gap-2">
                  {[
                    ["Leo Hart", "Screen share + microphone live"],
                    ["You", "Camera muted, microphone live"],
                  ].map(([label, meta]) => (
                    <div
                      key={label}
                      className="rounded-[18px] border border-white/6 bg-black/10 px-3 py-3"
                    >
                      <p className="text-sm font-medium text-white">{label}</p>
                      <p className="mt-1 text-xs text-[var(--text-dim)]">{meta}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="surface-subtle rounded-[22px] p-3">
                <p className="text-sm font-medium text-white">Live state</p>
                <div className="mt-3 grid gap-2 text-sm text-[var(--text-dim)]">
                  {[
                    ["Connection", "connected"],
                    ["Microphone", "Live"],
                    ["Camera", "Off"],
                    ["Screen share", "Publishing"],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="flex items-center justify-between gap-3 rounded-[16px] border border-white/6 bg-black/10 px-3 py-2.5"
                    >
                      <span>{label}</span>
                      <span className="text-[var(--text-soft)]">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PreviewShell>
  );
}
