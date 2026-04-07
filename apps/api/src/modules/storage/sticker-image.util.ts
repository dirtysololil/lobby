export interface StickerImageLimits {
  maxFrames: number;
  maxAnimationMs: number;
  maxDimension: number;
}

export interface StickerImageMetadata {
  mimeType: "image/png" | "image/webp" | "image/gif";
  extension: "png" | "webp" | "gif";
  width: number;
  height: number;
  bytes: number;
  isAnimated: boolean;
  frameCount: number | null;
  animationDurationMs: number | null;
}

const pngSignature = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const gif87a = Buffer.from("GIF87a", "ascii");
const gif89a = Buffer.from("GIF89a", "ascii");

export function parseStickerImageMetadata(
  buffer: Buffer,
  limits: StickerImageLimits,
): StickerImageMetadata {
  if (buffer.length < 10) {
    throw new Error("Файл стикера повреждён или пуст.");
  }

  if (buffer.subarray(0, 8).equals(pngSignature)) {
    return validateMetadata(parsePng(buffer), limits);
  }

  if (
    buffer.subarray(0, 6).equals(gif87a) ||
    buffer.subarray(0, 6).equals(gif89a)
  ) {
    return validateMetadata(parseGif(buffer, limits), limits);
  }

  if (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return validateMetadata(parseWebp(buffer), limits);
  }

  throw new Error("Поддерживаются только PNG, GIF и WEBP.");
}

function validateMetadata(
  metadata: StickerImageMetadata,
  limits: StickerImageLimits,
): StickerImageMetadata {
  if (metadata.width <= 0 || metadata.height <= 0) {
    throw new Error("Не удалось определить размеры стикера.");
  }

  if (
    metadata.width > limits.maxDimension ||
    metadata.height > limits.maxDimension
  ) {
    throw new Error(
      `Стикер слишком большой. Максимальный размер: ${limits.maxDimension}px по большей стороне.`,
    );
  }

  if (
    metadata.isAnimated &&
    metadata.frameCount !== null &&
    metadata.frameCount > limits.maxFrames
  ) {
    throw new Error(`Анимированный стикер превышает лимит в ${limits.maxFrames} кадров.`);
  }

  if (
    metadata.isAnimated &&
    metadata.animationDurationMs !== null &&
    metadata.animationDurationMs > limits.maxAnimationMs
  ) {
    throw new Error(
      `Анимация стикера длиннее ${limits.maxAnimationMs} мс.`,
    );
  }

  return metadata;
}

function parsePng(buffer: Buffer): StickerImageMetadata {
  if (buffer.length < 24) {
    throw new Error("PNG-стикер повреждён.");
  }

  let offset = 8;

  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");

    if (type === "acTL") {
      throw new Error("Анимированный PNG пока не поддерживается.");
    }

    offset += 12 + length;

    if (type === "IEND") {
      break;
    }
  }

  return {
    mimeType: "image/png",
    extension: "png",
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    bytes: buffer.length,
    isAnimated: false,
    frameCount: null,
    animationDurationMs: null,
  };
}

function parseGif(
  buffer: Buffer,
  limits: StickerImageLimits,
): StickerImageMetadata {
  const width = buffer.readUInt16LE(6);
  const height = buffer.readUInt16LE(8);
  let offset = 13;
  let frameCount = 0;
  let animationDurationMs = 0;
  let nextFrameDelayMs = 0;

  const packedHeader = buffer[10] ?? 0;
  const globalColorTableFlag = (packedHeader & 0x80) !== 0;
  const globalColorTableSize = 3 * 2 ** ((packedHeader & 0x07) + 1);

  if (globalColorTableFlag) {
    offset += globalColorTableSize;
  }

  while (offset < buffer.length) {
    const blockType = buffer[offset];

    if (blockType === 0x3b) {
      break;
    }

    if (blockType === 0x21) {
      const extensionLabel = buffer[offset + 1];

      if (extensionLabel === 0xf9) {
        if (offset + 7 > buffer.length) {
          break;
        }

        const delay = buffer.readUInt16LE(offset + 4);
        nextFrameDelayMs = Math.max(delay * 10, 10);
        offset += 8;
        continue;
      }

      offset = skipGifSubBlocks(buffer, offset + 2);
      continue;
    }

    if (blockType === 0x2c) {
      frameCount += 1;
      animationDurationMs += nextFrameDelayMs;
      nextFrameDelayMs = 0;

      if (frameCount > limits.maxFrames) {
        throw new Error(`Анимированный стикер превышает лимит в ${limits.maxFrames} кадров.`);
      }

      if (offset + 10 > buffer.length) {
        break;
      }

      const packedField = buffer[offset + 9] ?? 0;
      offset += 10;

      if ((packedField & 0x80) !== 0) {
        const localColorTableSize = 3 * 2 ** ((packedField & 0x07) + 1);
        offset += localColorTableSize;
      }

      offset += 1;
      offset = skipGifSubBlocks(buffer, offset);
      continue;
    }

    throw new Error("GIF-стикер повреждён.");
  }

  return {
    mimeType: "image/gif",
    extension: "gif",
    width,
    height,
    bytes: buffer.length,
    isAnimated: frameCount > 1,
    frameCount: frameCount > 0 ? frameCount : null,
    animationDurationMs: frameCount > 1 ? animationDurationMs : null,
  };
}

function skipGifSubBlocks(buffer: Buffer, startOffset: number): number {
  let offset = startOffset;

  while (offset < buffer.length) {
    const blockSize = buffer[offset] ?? 0;
    offset += 1;

    if (blockSize === 0) {
      return offset;
    }

    offset += blockSize;
  }

  return offset;
}

function parseWebp(buffer: Buffer): StickerImageMetadata {
  let offset = 12;
  let width: number | null = null;
  let height: number | null = null;

  while (offset + 8 <= buffer.length) {
    const chunkType = buffer.subarray(offset, offset + 4).toString("ascii");
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const dataOffset = offset + 8;

    if (chunkType === "ANIM" || chunkType === "ANMF") {
      throw new Error("Анимированный WEBP пока не поддерживается.");
    }

    if (
      chunkType === "VP8X" &&
      chunkSize >= 10 &&
      dataOffset + 10 <= buffer.length
    ) {
      width = 1 + buffer.readUIntLE(dataOffset + 4, 3);
      height = 1 + buffer.readUIntLE(dataOffset + 7, 3);
    }

    if (
      chunkType === "VP8 " &&
      chunkSize >= 10 &&
      dataOffset + 10 <= buffer.length
    ) {
      width = buffer.readUInt16LE(dataOffset + 6) & 0x3fff;
      height = buffer.readUInt16LE(dataOffset + 8) & 0x3fff;
    }

    if (
      chunkType === "VP8L" &&
      chunkSize >= 5 &&
      dataOffset + 5 <= buffer.length
    ) {
      const b0 = buffer[dataOffset + 1] ?? 0;
      const b1 = buffer[dataOffset + 2] ?? 0;
      const b2 = buffer[dataOffset + 3] ?? 0;
      const b3 = buffer[dataOffset + 4] ?? 0;

      width = 1 + (((b1 & 0x3f) << 8) | b0);
      height = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
    }

    offset = dataOffset + chunkSize + (chunkSize % 2);
  }

  if (!width || !height) {
    throw new Error("Не удалось определить размеры WEBP-стикера.");
  }

  return {
    mimeType: "image/webp",
    extension: "webp",
    width,
    height,
    bytes: buffer.length,
    isAnimated: false,
    frameCount: null,
    animationDurationMs: null,
  };
}
