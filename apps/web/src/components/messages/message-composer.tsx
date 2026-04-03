"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";

interface MessageComposerProps {
  disabled: boolean;
  onSend: (content: string) => Promise<void>;
}

export function MessageComposer({ disabled, onSend }: MessageComposerProps) {
  const [content, setContent] = useState("");
  const [isSending, setIsSending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!content.trim()) return;
    setIsSending(true);
    try {
      await onSend(content);
      setContent("");
    } finally { setIsSending(false); }
  }

  return (
    <form className="premium-tile space-y-3 rounded-3xl p-3" onSubmit={handleSubmit}>
      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder={disabled ? "Отправка отключена для этого диалога" : "Напишите сообщение"}
        disabled={disabled || isSending}
        className="min-h-28 w-full rounded-2xl border border-[var(--border)] bg-[#0b1322]/80 px-4 py-4 text-sm text-[var(--text)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--border-strong)] disabled:cursor-not-allowed disabled:opacity-60"
      />
      <div className="flex items-center justify-between gap-3"><p className="text-xs text-[var(--text-muted)]">Enter — отправка, Shift+Enter — новая строка.</p><Button type="submit" disabled={disabled || isSending}>{isSending ? "Отправка..." : "Отправить"}</Button></div>
    </form>
  );
}
