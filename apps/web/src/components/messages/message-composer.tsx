"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
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
      className="surface-highlight space-y-3 rounded-[24px] p-4"
      onSubmit={handleSubmit}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="section-kicker">Composer</p>
        <span className="status-pill">
          {disabled ? "Публикация отключена" : "Канал активен"}
        </span>
      </div>
      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={
          disabled
            ? "Отправка отключена для этого диалога"
            : "Напишите сообщение. Enter — отправка, Shift+Enter — новая строка."
        }
        disabled={disabled || isSending}
        className="field-textarea min-h-[92px] rounded-[18px] disabled:cursor-not-allowed disabled:opacity-60"
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-5 text-[var(--text-muted)]">
          Поток диалога поддерживает быстрый desktop-ритм: Enter отправляет,
          Shift+Enter оставляет перенос строки.
        </p>
        <Button type="submit" disabled={disabled || isSending}>
          {isSending ? "Отправка..." : "Отправить сообщение"}
        </Button>
      </div>
    </form>
  );
}
