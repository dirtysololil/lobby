"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { SendHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MessageComposerProps {
  disabled: boolean;
  onSend: (content: string) => Promise<void>;
}

const BASE_HEIGHT = 38;
const MAX_HEIGHT = 112;
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
    <form
      className="flex items-end gap-2 rounded-[22px] border border-white/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.025),transparent_42%),rgba(20,29,40,0.94)] px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_14px_24px_rgba(5,10,18,0.16)]"
      onSubmit={handleSubmit}
    >
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(event) => setContent(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={disabled ? "Messaging is unavailable in this chat." : "Message"}
        disabled={disabled || isSending}
        rows={1}
        className="block min-h-9 max-h-28 flex-1 resize-none rounded-[18px] border-none bg-transparent px-3 py-2 text-sm leading-tight text-white outline-none transition-colors placeholder:text-[var(--text-muted)] disabled:cursor-not-allowed disabled:opacity-60"
      />

      <Button
        type="submit"
        size="sm"
        disabled={disabled || isSending}
        className="h-8 w-8 rounded-full border border-white/8 bg-[var(--accent)] px-0 shadow-[0_10px_20px_rgba(8,16,26,0.22)] hover:bg-[var(--accent-strong)]"
        aria-label={isSending ? "Sending message" : "Send message"}
      >
        <SendHorizontal {...iconProps} />
      </Button>
    </form>
  );
}
