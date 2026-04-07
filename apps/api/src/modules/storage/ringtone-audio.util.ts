const allowedRingtoneExtensions = ['mp3', 'wav', 'ogg', 'm4a'] as const;

type AllowedRingtoneExtension = (typeof allowedRingtoneExtensions)[number];

const mimeTypeByExtension: Record<AllowedRingtoneExtension, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
};

const mp4Brands = new Set([
  'M4A',
  'M4B',
  'M4P',
  'M4V',
  'M4R',
  'isom',
  'iso2',
  'mp41',
  'mp42',
  'MSNV',
  'dash',
]);

function readAscii(buffer: Buffer, start: number, end: number) {
  return buffer.toString('ascii', start, end);
}

function getOriginalExtension(originalName: string | null | undefined) {
  const normalized = originalName?.trim().toLowerCase() ?? '';
  const lastDotIndex = normalized.lastIndexOf('.');

  if (lastDotIndex <= 0 || lastDotIndex === normalized.length - 1) {
    return null;
  }

  return normalized.slice(lastDotIndex + 1);
}

function isAllowedExtension(
  value: string | null,
): value is AllowedRingtoneExtension {
  return value !== null && allowedRingtoneExtensions.includes(value as AllowedRingtoneExtension);
}

function detectRingtoneExtension(
  buffer: Buffer,
): AllowedRingtoneExtension | null {
  if (buffer.length >= 12) {
    if (readAscii(buffer, 0, 4) === 'RIFF' && readAscii(buffer, 8, 12) === 'WAVE') {
      return 'wav';
    }

    if (readAscii(buffer, 0, 4) === 'OggS') {
      return 'ogg';
    }
  }

  if (buffer.length >= 3 && readAscii(buffer, 0, 3) === 'ID3') {
    return 'mp3';
  }

  if (
    buffer.length >= 2 &&
    buffer.readUInt8(0) === 0xff &&
    (buffer.readUInt8(1) & 0xe0) === 0xe0
  ) {
    return 'mp3';
  }

  if (buffer.length >= 12 && readAscii(buffer, 4, 8) === 'ftyp') {
    const boxSize = buffer.readUInt32BE(0);
    const maxBrandOffset =
      Number.isFinite(boxSize) && boxSize >= 16
        ? Math.min(buffer.length, boxSize)
        : Math.min(buffer.length, 32);

    for (let offset = 8; offset + 4 <= maxBrandOffset; offset += 4) {
      const rawBrand = readAscii(buffer, offset, offset + 4);
      const brand = rawBrand.trim();

      if (
        mp4Brands.has(rawBrand) ||
        brand.toLowerCase().startsWith('m4') ||
        brand.toLowerCase().startsWith('mp4')
      ) {
        return 'm4a';
      }
    }
  }

  return null;
}

function getFormatLabel(extension: AllowedRingtoneExtension) {
  switch (extension) {
    case 'mp3':
      return 'MP3';
    case 'wav':
      return 'WAV';
    case 'ogg':
      return 'OGG';
    case 'm4a':
      return 'M4A';
  }
}

export interface ParsedRingtoneAudioMetadata {
  bytes: number;
  extension: AllowedRingtoneExtension;
  mimeType: string;
}

export function parseRingtoneAudioMetadata(
  buffer: Buffer,
  originalName: string | null | undefined,
): ParsedRingtoneAudioMetadata {
  if (buffer.length === 0) {
    throw new Error('Файл рингтона пустой.');
  }

  const detectedExtension = detectRingtoneExtension(buffer);
  const namedExtension = getOriginalExtension(originalName);
  const allowedNamedExtension = isAllowedExtension(namedExtension)
    ? namedExtension
    : null;

  if (namedExtension && !allowedNamedExtension) {
    throw new Error('Поддерживаются только MP3, WAV, OGG и M4A.');
  }

  if (
    allowedNamedExtension &&
    detectedExtension &&
    allowedNamedExtension !== detectedExtension
  ) {
    throw new Error(
      `Файл не похож на ${getFormatLabel(allowedNamedExtension)}. Проверьте формат и загрузите корректный рингтон.`,
    );
  }

  const extension = detectedExtension ?? allowedNamedExtension;

  if (!extension) {
    throw new Error('Не удалось распознать формат рингтона. Поддерживаются MP3, WAV, OGG и M4A.');
  }

  return {
    bytes: buffer.length,
    extension,
    mimeType: mimeTypeByExtension[extension],
  };
}
