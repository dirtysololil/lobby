import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ffmpegPath from 'ffmpeg-static';
import ffprobe from 'ffprobe-static';
import sharp from 'sharp';

export interface StickerCropTransform {
  scale: number;
  translateX: number;
  translateY: number;
}

export interface StickerPipelineLimits {
  maxBytes: number;
  maxDimension: number;
  maxDurationMs: number;
}

export interface StickerSourceMetadata {
  extension: string;
  mimeType: string;
  width: number;
  height: number;
  durationMs: number | null;
  isAnimated: boolean;
}

export interface ProcessedStickerResult {
  metadata: StickerSourceMetadata;
  staticBuffer: Buffer;
  staticExtension: 'webp';
  staticMimeType: 'image/webp';
  animatedBuffer: Buffer | null;
  animatedExtension: 'webp' | null;
  animatedMimeType: 'image/webp' | null;
}

const outputSize = 224;

export async function processStickerUpload(args: {
  buffer: Buffer;
  originalName: string;
  mimeType: string | null | undefined;
  limits: StickerPipelineLimits;
  crop?: Partial<StickerCropTransform> | null;
}): Promise<ProcessedStickerResult> {
  if (args.buffer.byteLength === 0) {
    throw new Error('Файл стикера повреждён или пуст.');
  }

  if (args.buffer.byteLength > args.limits.maxBytes) {
    throw new Error('Файл стикера превышает допустимый размер.');
  }

  const source = await inspectStickerSource(
    args.buffer,
    args.originalName,
    args.mimeType,
  );

  if (
    source.width <= 0 ||
    source.height <= 0 ||
    source.width > args.limits.maxDimension ||
    source.height > args.limits.maxDimension
  ) {
    throw new Error(
      `Стикер слишком большой. Максимум ${args.limits.maxDimension}px по большей стороне.`,
    );
  }

  if (
    source.durationMs !== null &&
    source.durationMs > args.limits.maxDurationMs
  ) {
    throw new Error(
      `Анимация стикера длиннее ${args.limits.maxDurationMs} мс.`,
    );
  }

  const crop = normalizeCrop(args.crop);

  if (!source.isAnimated) {
    const staticBuffer = await renderStaticSticker(args.buffer, source, crop);

    return {
      metadata: source,
      staticBuffer,
      staticExtension: 'webp',
      staticMimeType: 'image/webp',
      animatedBuffer: null,
      animatedExtension: null,
      animatedMimeType: null,
    };
  }

  const animated = await renderAnimatedSticker(args.buffer, source, crop);

  return {
    metadata: source,
    staticBuffer: animated.posterBuffer,
    staticExtension: 'webp',
    staticMimeType: 'image/webp',
    animatedBuffer: animated.animatedBuffer,
    animatedExtension: 'webp',
    animatedMimeType: 'image/webp',
  };
}

async function inspectStickerSource(
  buffer: Buffer,
  originalName: string,
  mimeType: string | null | undefined,
): Promise<StickerSourceMetadata> {
  try {
    const metadata = await sharp(buffer, { animated: true }).metadata();
    const format = metadata.format?.toLowerCase();

    if (
      format === 'png' ||
      format === 'jpeg' ||
      format === 'jpg' ||
      format === 'gif' ||
      format === 'webp'
    ) {
      return {
        extension: resolveImageExtension(format),
        mimeType: resolveImageMimeType(format),
        width: metadata.width ?? 0,
        height: metadata.pageHeight ?? metadata.height ?? 0,
        durationMs: Array.isArray(metadata.delay)
          ? metadata.delay.reduce<number>(
              (sum: number, value: number) => sum + value,
              0,
            )
          : null,
        isAnimated: (metadata.pages ?? 1) > 1,
      };
    }
  } catch {
    // fall through to ffprobe for non-image formats
  }

  const probed = await probeVideoSource(buffer, originalName, mimeType);

  return {
    extension: probed.extension,
    mimeType: probed.mimeType,
    width: probed.width,
    height: probed.height,
    durationMs: probed.durationMs,
    isAnimated: true,
  };
}

async function renderStaticSticker(
  buffer: Buffer,
  source: StickerSourceMetadata,
  crop: StickerCropTransform,
): Promise<Buffer> {
  const targetFrame = createFrameTransform(source.width, source.height, crop);
  const resized = await sharp(buffer, { animated: false })
    .rotate()
    .resize(targetFrame.width, targetFrame.height, {
      fit: 'fill',
    })
    .webp({
      quality: 90,
    })
    .toBuffer();

  return await sharp({
    create: {
      width: outputSize,
      height: outputSize,
      channels: 4,
      background: {
        r: 0,
        g: 0,
        b: 0,
        alpha: 0,
      },
    },
  })
    .composite([
      {
        input: resized,
        left: targetFrame.left,
        top: targetFrame.top,
      },
    ])
    .webp({
      quality: 92,
    })
    .toBuffer();
}

async function renderAnimatedSticker(
  buffer: Buffer,
  source: StickerSourceMetadata,
  crop: StickerCropTransform,
): Promise<{ posterBuffer: Buffer; animatedBuffer: Buffer }> {
  const tempRoot = await mkdtemp(join(tmpdir(), 'lobby-sticker-'));
  const inputPath = join(tempRoot, `input.${source.extension}`);
  const posterPath = join(tempRoot, 'poster.webp');
  const animatedPath = join(tempRoot, 'animated.webp');
  const transform = createFrameTransform(source.width, source.height, crop);
  const scaleFilter = [
    `scale=${transform.width}:${transform.height}:flags=lanczos`,
    `pad=${outputSize}:${outputSize}:${transform.left}:${transform.top}:color=0x00000000`,
  ].join(',');
  const ffmpegBinaryPath = getRequiredBinaryPath(
    ffmpegPath,
    'ffmpeg',
    'Обработка анимированных стикеров недоступна: ffmpeg не найден.',
  );

  try {
    await writeFile(inputPath, buffer);

    await runBinary(ffmpegBinaryPath, [
      '-y',
      '-i',
      inputPath,
      '-frames:v',
      '1',
      '-vf',
      scaleFilter,
      posterPath,
    ]);

    await runBinary(ffmpegBinaryPath, [
      '-y',
      '-i',
      inputPath,
      '-an',
      '-vf',
      `${scaleFilter},fps=24`,
      '-loop',
      '0',
      '-preset',
      'picture',
      '-q:v',
      '70',
      '-compression_level',
      '4',
      animatedPath,
    ]);

    const [posterBuffer, animatedBuffer] = await Promise.all([
      readFile(posterPath),
      readFile(animatedPath),
    ]);

    return {
      posterBuffer,
      animatedBuffer,
    };
  } finally {
    await rm(tempRoot, {
      force: true,
      recursive: true,
    });
  }
}

async function probeVideoSource(
  buffer: Buffer,
  originalName: string,
  mimeType: string | null | undefined,
): Promise<StickerSourceMetadata> {
  const tempRoot = await mkdtemp(join(tmpdir(), 'lobby-sticker-probe-'));
  const extension = resolveVideoExtension(originalName, mimeType);
  const inputPath = join(tempRoot, `input.${extension}`);

  try {
    await writeFile(inputPath, buffer);
    const stdout = await runBinary(ffprobe.path, [
      '-v',
      'error',
      '-print_format',
      'json',
      '-show_streams',
      '-show_format',
      inputPath,
    ]);
    const payload = JSON.parse(stdout) as {
      streams?: Array<{
        codec_type?: string;
        width?: number;
        height?: number;
      }>;
      format?: {
        duration?: string;
      };
    };
    const videoStream = payload.streams?.find(
      (stream) => stream.codec_type === 'video',
    );
    const width = videoStream?.width ?? 0;
    const height = videoStream?.height ?? 0;
    const durationMs = payload.format?.duration
      ? Math.round(Number.parseFloat(payload.format.duration) * 1000)
      : null;

    if (!width || !height) {
      throw new Error('Не удалось определить размеры анимированного стикера.');
    }

    return {
      extension,
      mimeType:
        mimeType && mimeType.trim().length > 0
          ? mimeType
          : extension === 'mp4'
            ? 'video/mp4'
            : 'video/webm',
      width,
      height,
      durationMs,
      isAnimated: true,
    };
  } finally {
    await rm(tempRoot, {
      force: true,
      recursive: true,
    });
  }
}

function normalizeCrop(
  crop: Partial<StickerCropTransform> | null | undefined,
): StickerCropTransform {
  return {
    scale:
      typeof crop?.scale === 'number' && Number.isFinite(crop.scale)
        ? Math.min(4, Math.max(0.6, crop.scale))
        : 1,
    translateX:
      typeof crop?.translateX === 'number' && Number.isFinite(crop.translateX)
        ? crop.translateX
        : 0,
    translateY:
      typeof crop?.translateY === 'number' && Number.isFinite(crop.translateY)
        ? crop.translateY
        : 0,
  };
}

function createFrameTransform(
  sourceWidth: number,
  sourceHeight: number,
  crop: StickerCropTransform,
) {
  const baseScale = Math.max(outputSize / sourceWidth, outputSize / sourceHeight);
  const scaledWidth = Math.max(
    outputSize,
    Math.round(sourceWidth * baseScale * crop.scale),
  );
  const scaledHeight = Math.max(
    outputSize,
    Math.round(sourceHeight * baseScale * crop.scale),
  );

  return {
    width: scaledWidth,
    height: scaledHeight,
    left: Math.round((outputSize - scaledWidth) / 2 + crop.translateX),
    top: Math.round((outputSize - scaledHeight) / 2 + crop.translateY),
  };
}

function resolveImageExtension(format: string): string {
  switch (format) {
    case 'jpg':
    case 'jpeg':
      return 'jpg';
    default:
      return format;
  }
}

function resolveImageMimeType(format: string): string {
  switch (format) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    default:
      throw new Error('Поддерживаются PNG, JPG, JPEG, WEBP, GIF, MP4 и WEBM.');
  }
}

function resolveVideoExtension(
  originalName: string,
  mimeType: string | null | undefined,
): 'mp4' | 'webm' {
  const normalizedName = originalName.trim().toLowerCase();
  const normalizedMime = mimeType?.trim().toLowerCase() ?? '';

  if (normalizedMime === 'video/mp4' || normalizedName.endsWith('.mp4')) {
    return 'mp4';
  }

  if (normalizedMime === 'video/webm' || normalizedName.endsWith('.webm')) {
    return 'webm';
  }

  throw new Error('Поддерживаются PNG, JPG, JPEG, WEBP, GIF, MP4 и WEBM.');
}

function runBinary(binaryPath: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(binaryPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });
    child.on('error', (error) => {
      reject(error);
    });
    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }

      reject(new Error(stderr.trim() || `${binaryPath} exited with code ${code}`));
    });
  });
}

function getRequiredBinaryPath(
  binaryPath: string | null | undefined,
  name: string,
  errorMessage: string,
): string {
  if (typeof binaryPath === 'string' && binaryPath.trim().length > 0) {
    return binaryPath;
  }

  throw new Error(`${errorMessage} (${name})`);
}
