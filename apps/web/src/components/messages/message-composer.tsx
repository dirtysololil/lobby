"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
import { SendHorizontal } from "lucide-react";
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

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSubmit(event as unknown as FormEvent<HTMLFormElement>);
    }
  }

  return (
    <form
      className="rounded-[16px] border border-[var(--border)] bg-white/[0.03] p-2.5"
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              disabled
                ? "Отправка отключена для этого диалога"
                : "Напишите сообщение"
            }
            disabled={disabled || isSending}
            rows={1}
            className="field-textarea min-h-[40px] rounded-[12px] disabled:cursor-not-allowed disabled:opacity-60"
          />
          <p className="mt-1.5 text-[11px] text-[var(--text-muted)]">
            Enter отправляет.
          </p>
        </div>
        <Button type="submit" disabled={disabled || isSending}>
          <SendHorizontal className="h-4 w-4" />
          {isSending ? "Отправка..." : "Отправить"}
        </Button>
      </div>
    </form>
  );
}
