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

    if (!content.trim()) {
      return;
    }

    setIsSending(true);

    try {
      await onSend(content);
      setContent("");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder={disabled ? "Messaging is disabled for this conversation" : "Write a direct message"}
        disabled={disabled || isSending}
        className="min-h-32 w-full rounded-3xl border border-white/10 bg-slate-950/50 px-4 py-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-sky-300/50 focus:bg-slate-950/70 disabled:cursor-not-allowed disabled:opacity-60"
      />
      <Button type="submit" disabled={disabled || isSending}>
        {isSending ? "Sending..." : "Send message"}
      </Button>
    </form>
  );
}
