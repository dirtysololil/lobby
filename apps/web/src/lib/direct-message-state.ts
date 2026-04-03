import type {
  DirectConversationSummary,
  DirectMessage,
  DmSignal,
} from "@lobby/shared";

export function sortDirectConversations(
  items: DirectConversationSummary[],
): DirectConversationSummary[] {
  return [...items].sort((left, right) => {
    if (left.unreadCount !== right.unreadCount) {
      return right.unreadCount - left.unreadCount;
    }

    return (
      new Date(right.lastMessageAt ?? 0).getTime() -
      new Date(left.lastMessageAt ?? 0).getTime()
    );
  });
}

export function upsertDirectConversationSummary(
  items: DirectConversationSummary[],
  summary: DirectConversationSummary,
): DirectConversationSummary[] {
  const nextItems = items.filter((item) => item.id !== summary.id);
  nextItems.unshift(summary);

  return sortDirectConversations(nextItems);
}

export function applyDmSignalToConversationSummaries(
  items: DirectConversationSummary[],
  signal: DmSignal,
): DirectConversationSummary[] {
  return upsertDirectConversationSummary(items, signal.conversation);
}

export function mergeDirectMessage<T extends DirectMessage>(
  items: T[],
  message: T,
): T[] {
  const nextItems = [...items];
  const byIdIndex = nextItems.findIndex((item) => item.id === message.id);

  if (byIdIndex >= 0) {
    nextItems[byIdIndex] = {
      ...nextItems[byIdIndex],
      ...message,
    };

    return sortDirectMessages(nextItems);
  }

  if (message.clientNonce) {
    const byNonceIndex = nextItems.findIndex(
      (item) => item.clientNonce && item.clientNonce === message.clientNonce,
    );

    if (byNonceIndex >= 0) {
      nextItems[byNonceIndex] = {
        ...nextItems[byNonceIndex],
        ...message,
      };

      return sortDirectMessages(nextItems);
    }
  }

  nextItems.push(message);
  return sortDirectMessages(nextItems);
}

export function removeDirectMessage(
  items: DirectMessage[],
  messageId: string,
): DirectMessage[] {
  return items.filter((item) => item.id !== messageId);
}

export function sortDirectMessages<T extends DirectMessage>(items: T[]): T[] {
  return [...items].sort(
    (left, right) =>
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
  );
}
