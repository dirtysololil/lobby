export interface AvatarImageLimits {
  maxFrames: number;
  maxAnimationMs: number;
}

export interface AvatarImageMetadata {
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';
  extension: 'png' | 'jpg' | 'webp' | 'gif';
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
const gif87a = Buffer.from('GIF87a', 'ascii');
const gif89a = Buffer.from('GIF89a', 'ascii');

export function parseAvatarImageMetadata(
  buffer: Buffer,
  limits: AvatarImageLimits,
): AvatarImageMetadata {
  if (buffer.length < 10) {
    throw new Error('Avatar file is invalid');
  }

  if (buffer.subarray(0, 8).equals(pngSignature)) {
    return validateMetadata(parsePng(buffer), limits);
  }

  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    return validateMetadata(parseJpeg(buffer), limits);
  }

  if (
    buffer.subarray(0, 6).equals(gif87a) ||
    buffer.subarray(0, 6).equals(gif89a)
  ) {
    return validateMetadata(parseGif(buffer, limits), limits);
  }

  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return validateMetadata(parseWebp(buffer), limits);
  }

  throw new Error(
    'Unsupported avatar format. Allowed formats: PNG, JPEG, GIF and WEBP',
  );
}

function validateMetadata(
  metadata: AvatarImageMetadata,
  limits: AvatarImageLimits,
): AvatarImageMetadata {
  if (metadata.width <= 0 || metadata.height <= 0) {
    throw new Error('Avatar image dimensions could not be resolved');
  }

  if (
    metadata.isAnimated &&
    metadata.frameCount !== null &&
    metadata.frameCount > limits.maxFrames
  ) {
    throw new Error(`Animated avatar exceeds ${limits.maxFrames} frames`);
  }

  if (
    metadata.isAnimated &&
    metadata.animationDurationMs !== null &&
    metadata.animationDurationMs > limits.maxAnimationMs
  ) {
    throw new Error(
      `Animated avatar exceeds ${limits.maxAnimationMs}ms duration`,
    );
  }

  return metadata;
}

function parsePng(buffer: Buffer): AvatarImageMetadata {
  if (buffer.length < 24) {
    throw new Error('PNG avatar is invalid');
  }

  let offset = 8;
  let hasAnimationChunk = false;

  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');

    if (type === 'acTL') {
      hasAnimationChunk = true;
      break;
    }

    offset += 12 + length;

    if (type === 'IEND') {
      break;
    }
  }

  if (hasAnimationChunk) {
    throw new Error('Animated PNG avatars are not allowed');
  }

  return {
    mimeType: 'image/png',
    extension: 'png',
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    bytes: buffer.length,
    isAnimated: false,
    frameCount: null,
    animationDurationMs: null,
  };
}

function parseJpeg(buffer: Buffer): AvatarImageMetadata {
  let offset = 2;

  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1] ?? -1;

    if (marker === 0xda || marker === 0xd9) {
      break;
    }

    if (offset + 4 > buffer.length) {
      break;
    }

    const segmentLength = buffer.readUInt16BE(offset + 2);

    if (
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc
    ) {
      if (offset + 9 >= buffer.length) {
        break;
      }

      return {
        mimeType: 'image/jpeg',
        extension: 'jpg',
        width: buffer.readUInt16BE(offset + 7),
        height: buffer.readUInt16BE(offset + 5),
        bytes: buffer.length,
        isAnimated: false,
        frameCount: null,
        animationDurationMs: null,
      };
    }

    offset += 2 + segmentLength;
  }

  throw new Error('JPEG avatar dimensions could not be resolved');
}

function parseGif(
  buffer: Buffer,
  limits: AvatarImageLimits,
): AvatarImageMetadata {
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
        throw new Error(`Animated avatar exceeds ${limits.maxFrames} frames`);
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

    throw new Error('GIF avatar is invalid');
  }

  return {
    mimeType: 'image/gif',
    extension: 'gif',
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

function parseWebp(buffer: Buffer): AvatarImageMetadata {
  let offset = 12;
  let width: number | null = null;
  let height: number | null = null;

  while (offset + 8 <= buffer.length) {
    const chunkType = buffer.subarray(offset, offset + 4).toString('ascii');
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const dataOffset = offset + 8;

    if (chunkType === 'ANIM' || chunkType === 'ANMF') {
      throw new Error('Animated WEBP avatars are not allowed');
    }

    if (
      chunkType === 'VP8X' &&
      chunkSize >= 10 &&
      dataOffset + 10 <= buffer.length
    ) {
      width = 1 + buffer.readUIntLE(dataOffset + 4, 3);
      height = 1 + buffer.readUIntLE(dataOffset + 7, 3);
    }

    if (
      chunkType === 'VP8 ' &&
      chunkSize >= 10 &&
      dataOffset + 10 <= buffer.length
    ) {
      width = buffer.readUInt16LE(dataOffset + 6) & 0x3fff;
      height = buffer.readUInt16LE(dataOffset + 8) & 0x3fff;
    }

    if (
      chunkType === 'VP8L' &&
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
    throw new Error('WEBP avatar dimensions could not be resolved');
  }

  return {
    mimeType: 'image/webp',
    extension: 'webp',
    width,
    height,
    bytes: buffer.length,
    isAnimated: false,
    frameCount: null,
    animationDurationMs: null,
  };
}
