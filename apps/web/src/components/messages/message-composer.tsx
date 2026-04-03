"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { SendHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MessageComposerProps {
  disabled: boolean;
  onSend: (content: string) => Promise<void>;
}

const BASE_HEIGHT = 40;
const MAX_HEIGHT = 128;
const iconProps = { size: 18, strokeWidth: 1.5 } as const;

export function MessageComposer({ disabled, onSend }: MessageComposerProps) {
  const [content, setContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const element = textareaRef.current;

    if (!element) {
      return;
    }

    element.style.height = `${BASE_HEIGHT}px`;
    const nextHeight = Math.min(element.scrollHeight, MAX_HEIGHT);
    element.style.height = `${nextHeight}px`;
    element.style.overflowY = element.scrollHeight > MAX_HEIGHT ? "auto" : "hidden";
  }, [content]);

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
    <form className="flex items-end gap-2" onSubmit={handleSubmit}>
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(event) => setContent(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={disabled ? "Messaging is unavailable in this chat." : "Message"}
        disabled={disabled || isSending}
        rows={1}
        className="block min-h-10 max-h-32 flex-1 resize-none rounded-2xl border border-white/5 bg-[#121214] px-4 py-2 text-sm leading-tight text-white outline-none transition-colors placeholder:text-zinc-500 focus:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
      />

      <Button
        type="submit"
        size="sm"
        disabled={disabled || isSending}
        className="h-9 w-9 rounded-full px-0"
        aria-label={isSending ? "Sending message" : "Send message"}
      >
        <SendHorizontal {...iconProps} />
      </Button>
    </form>
  );
}
