"use client";

/* eslint-disable @next/next/no-img-element */
import type { CustomEmojiAsset } from "@lobby/shared";
import { Fragment, useMemo } from "react";
import {
  customEmojiTokenPattern,
  getCustomEmojiAssetUrl,
} from "@/lib/stickers";
import { cn } from "@/lib/utils";

interface InlineCustomEmojiTextProps {
  text: string;
  customEmojis: CustomEmojiAsset[];
  className?: string;
}

export function InlineCustomEmojiText({
  text,
  customEmojis,
  className,
}: InlineCustomEmojiTextProps) {
  const emojiByAlias = useMemo(
    () =>
      new Map(customEmojis.map((emoji) => [emoji.alias.toLowerCase(), emoji])),
    [customEmojis],
  );
  const parts = useMemo(() => buildInlineParts(text, emojiByAlias), [emojiByAlias, text]);

  return (
    <span className={cn("whitespace-pre-wrap break-words", className)}>
      {parts.map((part, index) => {
        if (part.type === "text") {
          return <Fragment key={`text-${index}`}>{part.value}</Fragment>;
        }

        return (
          <img
            key={`emoji-${part.emoji.id}-${index}`}
            src={getCustomEmojiAssetUrl(part.emoji)}
            alt={part.emoji.title}
            className="mx-[0.08em] inline-block h-[1.28em] w-[1.28em] translate-y-[0.22em] rounded-[0.32em] object-contain align-baseline"
            draggable={false}
            loading="lazy"
          />
        );
      })}
    </span>
  );
}

type InlinePart =
  | { type: "text"; value: string }
  | { type: "emoji"; emoji: CustomEmojiAsset };

function buildInlineParts(
  text: string,
  emojiByAlias: Map<string, CustomEmojiAsset>,
): InlinePart[] {
  const parts: InlinePart[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(customEmojiTokenPattern)) {
    const fullMatch = match[0];
    const alias = match[1]?.toLowerCase();
    const index = match.index ?? -1;

    if (index < 0 || !alias) {
      continue;
    }

    if (index > lastIndex) {
      parts.push({
        type: "text",
        value: text.slice(lastIndex, index),
      });
    }

    const emoji = emojiByAlias.get(alias);

    if (emoji) {
      parts.push({
        type: "emoji",
        emoji,
      });
    } else {
      parts.push({
        type: "text",
        value: fullMatch,
      });
    }

    lastIndex = index + fullMatch.length;
  }

  if (lastIndex < text.length) {
    parts.push({
      type: "text",
      value: text.slice(lastIndex),
    });
  }

  return parts.length > 0 ? parts : [{ type: "text", value: text }];
}
