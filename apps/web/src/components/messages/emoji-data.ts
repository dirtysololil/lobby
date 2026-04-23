import type { EmojiCategoryId, EmojiManifestEntry, EmojiTone } from "@lobby/shared";
import { emojiManifestEntries } from "@/lib/emoji/manifest";

export type EmojiEntry = EmojiManifestEntry;

export interface EmojiCategory {
  id: Exclude<EmojiCategoryId, "recent">;
  label: string;
  emojis: EmojiEntry[];
}

export const emojiToneOptions: Array<{ id: EmojiTone; label: string }> = [
  { id: "default", label: "По умолчанию" },
  { id: "light", label: "Светлый" },
  { id: "medium-light", label: "Светло-средний" },
  { id: "medium", label: "Средний" },
  { id: "medium-dark", label: "Тёмно-средний" },
  { id: "dark", label: "Тёмный" },
];

const categoryLabels: Record<Exclude<EmojiCategoryId, "recent">, string> = {
  smileys: "Лица",
  people: "Жесты",
  nature: "Природа",
  food: "Еда",
  travel: "Места",
  activity: "Активность",
  symbols: "Символы",
  flags: "Флаги",
};

export const emojiCategories: EmojiCategory[] = (
  Object.keys(categoryLabels) as Array<Exclude<EmojiCategoryId, "recent">>
).map((categoryId) => ({
  id: categoryId,
  label: categoryLabels[categoryId],
  emojis: emojiManifestEntries.filter((entry) => entry.category === categoryId),
}));
