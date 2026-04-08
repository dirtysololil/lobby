"use client";

/* eslint-disable @next/next/no-img-element */
import type { CustomEmojiAsset } from "@lobby/shared";
import { Fragment, useMemo } from "react";
import { EmojiGlyph } from "@/lib/emoji/emoji-glyph";
import { isEmojiCluster, splitGraphemes } from "@/lib/emoji/unicode";
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

type InlinePart =
  | { type: "text"; value: string }
  | { type: "emoji"; emoji: CustomEmojiAsset }
  | { type: "unicodeEmoji"; value: string }
  | { type: "url"; value: string; href: string };

const urlPattern = /https?:\/\/[^\s<>"'`]+/giu;

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

        if (part.type === "url") {
          return (
            <a
              key={`url-${part.href}-${index}`}
              href={part.href}
              target="_blank"
              rel="noreferrer"
              className="text-[color:var(--accent)] underline decoration-white/10 underline-offset-2 transition-colors hover:text-white"
            >
              {part.value}
            </a>
          );
        }

        if (part.type === "unicodeEmoji") {
          return (
            <EmojiGlyph
              key={`unicode-emoji-${index}`}
              emoji={part.value}
              className="mx-[0.04em] inline-block h-[1.22em] w-[1.22em] translate-y-[0.14em]"
              fallbackClassName="mx-[0.02em] inline-block"
            />
          );
        }

        return (
          <img
            key={`emoji-${part.emoji.id}-${index}`}
            src={getCustomEmojiAssetUrl(part.emoji)}
            alt={part.emoji.title}
            className="mx-[0.06em] inline-block h-[1.36em] w-[1.36em] translate-y-[0.18em] rounded-[0.32em] object-contain align-baseline"
            draggable={false}
            loading="lazy"
          />
        );
      })}
    </span>
  );
}

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
      parts.push(...buildPlainTextParts(text.slice(lastIndex, index)));
    }

    const emoji = emojiByAlias.get(alias);

    if (emoji) {
      parts.push({
        type: "emoji",
        emoji,
      });
    } else {
      parts.push(...buildPlainTextParts(fullMatch));
    }

    lastIndex = index + fullMatch.length;
  }

  if (lastIndex < text.length) {
    parts.push(...buildPlainTextParts(text.slice(lastIndex)));
  }

  return parts.length > 0 ? parts : [{ type: "text", value: text }];
}

function buildPlainTextParts(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(urlPattern)) {
    const rawUrl = match[0];
    const index = match.index ?? -1;

    if (index < 0) {
      continue;
    }

    if (index > lastIndex) {
      parts.push(...buildUnicodeParts(text.slice(lastIndex, index)));
    }

    const sanitizedUrl = sanitizeUrl(rawUrl);

    if (sanitizedUrl) {
      parts.push({
        type: "url",
        value: rawUrl,
        href: sanitizedUrl,
      });
    } else {
      parts.push(...buildUnicodeParts(rawUrl));
    }

    lastIndex = index + rawUrl.length;
  }

  if (lastIndex < text.length) {
    parts.push(...buildUnicodeParts(text.slice(lastIndex)));
  }

  return parts;
}

function buildUnicodeParts(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  let currentText = "";

  for (const grapheme of splitGraphemes(text)) {
    if (isEmojiCluster(grapheme)) {
      if (currentText) {
        parts.push({
          type: "text",
          value: currentText,
        });
        currentText = "";
      }

      parts.push({
        type: "unicodeEmoji",
        value: grapheme,
      });
      continue;
    }

    currentText += grapheme;
  }

  if (currentText) {
    parts.push({
      type: "text",
      value: currentText,
    });
  }

  return parts;
}

function sanitizeUrl(value: string): string | null {
  try {
    const url = new URL(value.replace(/[),.;!?]+$/g, ""));
    return /^https?:$/i.test(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}
