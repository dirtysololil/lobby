import {
  reactionEmojiSchema,
  reactionEmojiValues,
  type ContentReaction,
} from '@lobby/shared';

type ReactionRecord = {
  emoji: string;
  userId: string;
};

const reactionOrder = new Map(
  reactionEmojiValues.map((emoji, index) => [emoji, index]),
);

export function toContentReactions(
  reactions: ReactionRecord[] | undefined,
  viewerId?: string | null,
): ContentReaction[] {
  const byEmoji = new Map<string, ContentReaction>();

  for (const reaction of reactions ?? []) {
    const parsedEmoji = reactionEmojiSchema.safeParse(reaction.emoji);

    if (!parsedEmoji.success) {
      continue;
    }

    const emoji = parsedEmoji.data;
    const current =
      byEmoji.get(emoji) ??
      ({
        emoji,
        count: 0,
        reactedByViewer: false,
      } satisfies ContentReaction);

    current.count += 1;
    current.reactedByViewer =
      current.reactedByViewer || reaction.userId === viewerId;
    byEmoji.set(emoji, current);
  }

  return [...byEmoji.values()].sort(
    (left, right) =>
      (reactionOrder.get(left.emoji) ?? Number.MAX_SAFE_INTEGER) -
      (reactionOrder.get(right.emoji) ?? Number.MAX_SAFE_INTEGER),
  );
}
