export type EmojiCategoryId =
  | "recent"
  | "smileys"
  | "people"
  | "nature"
  | "food"
  | "travel"
  | "activity"
  | "symbols";

export interface EmojiEntry {
  emoji: string;
  label: string;
  keywords: string[];
}

export interface EmojiCategory {
  id: Exclude<EmojiCategoryId, "recent">;
  label: string;
  emojis: EmojiEntry[];
}

function createEmoji(
  emoji: string,
  label: string,
  keywords: string[],
): EmojiEntry {
  return {
    emoji,
    label,
    keywords,
  };
}

export const emojiCategories: EmojiCategory[] = [
  {
    id: "smileys",
    label: "Лица",
    emojis: [
      createEmoji("😀", "улыбка", ["смайл", "радость", "happy"]),
      createEmoji("😁", "улыбка с зубами", ["радость", "grin"]),
      createEmoji("😂", "слёзы радости", ["смех", "lol"]),
      createEmoji("🤣", "катаюсь от смеха", ["смех", "rofl"]),
      createEmoji("😊", "тёплая улыбка", ["милый", "nice"]),
      createEmoji("🙂", "лёгкая улыбка", ["ok", "normal"]),
      createEmoji("😉", "подмигивание", ["wink"]),
      createEmoji("😍", "влюблённость", ["love", "heart eyes"]),
      createEmoji("😘", "поцелуй", ["kiss"]),
      createEmoji("😎", "круто", ["cool"]),
      createEmoji("🥲", "улыбка со слезой", ["тепло", "эмоции"]),
      createEmoji("🤔", "задумался", ["think"]),
      createEmoji("🫡", "уважение", ["salute"]),
      createEmoji("😴", "сон", ["sleep"]),
      createEmoji("😭", "рыдаю", ["cry"]),
      createEmoji("😤", "фыркаю", ["anger", "steam"]),
      createEmoji("😡", "злость", ["angry"]),
      createEmoji("🤯", "взорвало мозг", ["mind blown"]),
      createEmoji("🥳", "праздник", ["party"]),
      createEmoji("🤡", "клоун", ["clown"]),
    ],
  },
  {
    id: "people",
    label: "Жесты",
    emojis: [
      createEmoji("👍", "палец вверх", ["like", "ok"]),
      createEmoji("👎", "палец вниз", ["dislike"]),
      createEmoji("👏", "аплодисменты", ["clap"]),
      createEmoji("🙌", "ура", ["celebrate"]),
      createEmoji("🤝", "рукопожатие", ["deal"]),
      createEmoji("🙏", "спасибо", ["thanks", "please"]),
      createEmoji("🫶", "сердце руками", ["love"]),
      createEmoji("💪", "сила", ["strong"]),
      createEmoji("👀", "смотрю", ["watch"]),
      createEmoji("🔥", "огонь", ["fire", "hot"]),
      createEmoji("🫠", "плыву", ["melt"]),
      createEmoji("🤝", "договорились", ["agree"]),
      createEmoji("🤌", "ну давай", ["italian", "gesture"]),
      createEmoji("✌️", "победа", ["peace"]),
      createEmoji("🤞", "скрестил пальцы", ["luck"]),
    ],
  },
  {
    id: "nature",
    label: "Природа",
    emojis: [
      createEmoji("🌿", "ветка", ["leaf"]),
      createEmoji("🌙", "луна", ["moon"]),
      createEmoji("⭐", "звезда", ["star"]),
      createEmoji("☀️", "солнце", ["sun"]),
      createEmoji("🌧️", "дождь", ["rain"]),
      createEmoji("❄️", "снег", ["snow"]),
      createEmoji("🌊", "волна", ["wave"]),
      createEmoji("🐈", "кот", ["cat"]),
      createEmoji("🐶", "собака", ["dog"]),
      createEmoji("🦊", "лиса", ["fox"]),
      createEmoji("🐼", "панда", ["panda"]),
      createEmoji("🦉", "сова", ["owl"]),
    ],
  },
  {
    id: "food",
    label: "Еда",
    emojis: [
      createEmoji("☕", "кофе", ["coffee"]),
      createEmoji("🍵", "чай", ["tea"]),
      createEmoji("🥐", "круассан", ["breakfast"]),
      createEmoji("🍕", "пицца", ["pizza"]),
      createEmoji("🍔", "бургер", ["burger"]),
      createEmoji("🍜", "лапша", ["ramen"]),
      createEmoji("🍣", "суши", ["sushi"]),
      createEmoji("🍫", "шоколад", ["sweet"]),
      createEmoji("🍓", "клубника", ["berry"]),
      createEmoji("🍋", "лимон", ["lemon"]),
    ],
  },
  {
    id: "travel",
    label: "Места",
    emojis: [
      createEmoji("🏠", "дом", ["home"]),
      createEmoji("🌆", "город", ["city"]),
      createEmoji("✈️", "самолёт", ["plane"]),
      createEmoji("🚗", "машина", ["car"]),
      createEmoji("🚇", "метро", ["metro"]),
      createEmoji("🗺️", "карта", ["map"]),
      createEmoji("🧭", "компас", ["compass"]),
      createEmoji("🏖️", "пляж", ["beach"]),
      createEmoji("🏔️", "горы", ["mountain"]),
    ],
  },
  {
    id: "activity",
    label: "Активность",
    emojis: [
      createEmoji("🎮", "игры", ["game"]),
      createEmoji("🎧", "музыка", ["music"]),
      createEmoji("🎬", "кино", ["movie"]),
      createEmoji("📚", "книги", ["books"]),
      createEmoji("⚽", "футбол", ["sport"]),
      createEmoji("🏀", "баскетбол", ["sport"]),
      createEmoji("🎯", "цель", ["target"]),
      createEmoji("🧩", "пазл", ["puzzle"]),
      createEmoji("🎉", "конфетти", ["party"]),
    ],
  },
  {
    id: "symbols",
    label: "Символы",
    emojis: [
      createEmoji("❤️", "сердце", ["love", "heart"]),
      createEmoji("🖤", "чёрное сердце", ["heart"]),
      createEmoji("💔", "разбитое сердце", ["heartbreak"]),
      createEmoji("💯", "сто процентов", ["100"]),
      createEmoji("✨", "искры", ["sparkles"]),
      createEmoji("⚡", "молния", ["zap"]),
      createEmoji("✅", "готово", ["done", "check"]),
      createEmoji("❌", "крестик", ["no"]),
      createEmoji("❗", "важно", ["important"]),
      createEmoji("❓", "вопрос", ["question"]),
    ],
  },
];
