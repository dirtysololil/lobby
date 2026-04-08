import { randomBytes } from 'node:crypto';

const maxStickerPackSlugLength = 120;
const cyrillicToLatinMap: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'yo',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'shch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
  є: 'ye',
  і: 'i',
  ї: 'yi',
  ґ: 'g',
  ў: 'u',
};

export function buildStickerPackSlug(
  value: string,
  fallbackId?: string,
): string {
  const transliterated = Array.from(value.trim().toLowerCase())
    .map((character) => cyrillicToLatinMap[character] ?? character)
    .join('')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');

  const normalized = trimSlug(
    transliterated
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-'),
  );

  if (normalized) {
    return normalized;
  }

  return trimSlug(`sticker-pack-${sanitizeFallbackId(fallbackId ?? createShortId())}`);
}

export function buildStickerPackSlugVariant(
  baseSlug: string,
  sequence: number,
): string {
  if (sequence <= 1) {
    return trimSlug(baseSlug);
  }

  const suffix = `-${sequence}`;
  const trimmedBase = trimSlug(baseSlug).slice(
    0,
    Math.max(1, maxStickerPackSlugLength - suffix.length),
  );

  return trimSlug(`${trimmedBase}${suffix}`);
}

export function buildStickerPackSlugFallbackFromId(id: string): string {
  return buildStickerPackSlug('', id.slice(-8));
}

function trimSlug(value: string): string {
  return value
    .slice(0, maxStickerPackSlugLength)
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function sanitizeFallbackId(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 10);

  return normalized || createShortId();
}

function createShortId(): string {
  return randomBytes(4).toString('hex');
}
