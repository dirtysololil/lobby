import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import sharp from 'sharp';
import {
  resolveFfmpegBinaryPath,
  resolveFfprobeBinaryPath,
} from './ffmpeg-binaries.util';

export interface DirectMessageAttachmentPipelineLimits {
  maxBytes: number;
  maxImageDimension: number;
  maxVideoDimension: number;
  maxVideoDurationMs: number;
}

export interface ProcessedDirectMessageAttachment {
  kind: 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  assetBuffer: Buffer;
  extension: string;
  mimeType: string;
  originalName: string;
  fileSize: number;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  previewBuffer: Buffer | null;
  previewExtension: 'webp' | null;
  previewMimeType: 'image/webp' | null;
  inlinePlaybackBuffer: Buffer | null;
  inlinePlaybackExtension: 'mp4' | null;
  inlinePlaybackMimeType: 'video/mp4' | null;
}

const supportedImageFormats = new Set(['png', 'jpeg', 'jpg', 'webp', 'gif']);
const videoNoteFilePrefix = 'lobby-video-note-';
const voiceNoteFilePrefix = 'lobby-voice-note-';
type VideoNoteTranscodeProfile = {
  maxDimension: number;
  targetFps: number;
  crf: number;
  maxRateKbps: number;
  bufferKbps: number;
  audioBitrateKbps: number;
  preset: 'fast' | 'medium';
  h264Profile: 'main' | 'high';
  level: string;
};

const primaryVideoNoteTranscodeProfile: VideoNoteTranscodeProfile = {
  maxDimension: 720,
  targetFps: 30,
  crf: 20,
  maxRateKbps: 3_000,
  bufferKbps: 6_000,
  audioBitrateKbps: 96,
  preset: 'medium',
  h264Profile: 'high',
  level: '4.0',
};

const inlineVideoNoteTranscodeProfile: VideoNoteTranscodeProfile = {
  maxDimension: 480,
  targetFps: 24,
  crf: 24,
  maxRateKbps: 1_400,
  bufferKbps: 2_800,
  audioBitrateKbps: 64,
  preset: 'fast',
  h264Profile: 'main',
  level: '3.1',
};
const documentMimeTypes = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/ogg',
  'audio/webm',
  'audio/wav',
  'audio/x-wav',
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
  'application/zip',
  'application/x-zip-compressed',
  'application/x-7z-compressed',
  'application/vnd.rar',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);
const documentExtensions = new Set([
  'mp3',
  'm4a',
  'ogg',
  'wav',
  'webm',
  'pdf',
  'txt',
  'md',
  'csv',
  'json',
  'zip',
  '7z',
  'rar',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
]);

export async function processDirectMessageAttachmentUpload(args: {
  buffer: Buffer;
  originalName: string | null | undefined;
  mimeType: string | null | undefined;
  limits: DirectMessageAttachmentPipelineLimits;
}): Promise<ProcessedDirectMessageAttachment> {
  if (args.buffer.byteLength === 0) {
    throw new Error('Файл повреждён или пуст.');
  }

  if (args.buffer.byteLength > args.limits.maxBytes) {
    throw new Error('Файл превышает допустимый размер.');
  }

  const originalName = normalizeOriginalName(args.originalName, args.mimeType);
  const imageResult = await tryProcessImageAttachment({
    buffer: args.buffer,
    originalName,
    mimeType: args.mimeType,
    limits: args.limits,
  });

  if (imageResult) {
    return imageResult;
  }

  const videoResult = await tryProcessVideoAttachment({
    buffer: args.buffer,
    originalName,
    mimeType: args.mimeType,
    limits: args.limits,
  });

  if (videoResult) {
    return videoResult;
  }

  return processDocumentAttachment({
    buffer: args.buffer,
    originalName,
    mimeType: args.mimeType,
  });
}

async function tryProcessImageAttachment(args: {
  buffer: Buffer;
  originalName: string;
  mimeType: string | null | undefined;
  limits: DirectMessageAttachmentPipelineLimits;
}): Promise<ProcessedDirectMessageAttachment | null> {
  try {
    const metadata = await sharp(args.buffer, { animated: true }).metadata();
    const format = metadata.format?.toLowerCase() ?? '';

    if (!supportedImageFormats.has(format)) {
      return null;
    }

    const width = metadata.width ?? 0;
    const height = metadata.pageHeight ?? metadata.height ?? 0;

    if (
      width <= 0 ||
      height <= 0 ||
      width > args.limits.maxImageDimension ||
      height > args.limits.maxImageDimension
    ) {
      throw new Error(
        `Изображение слишком большое. Максимум ${args.limits.maxImageDimension}px по большей стороне.`,
      );
    }

    return {
      kind: 'IMAGE',
      assetBuffer: args.buffer,
      extension: resolveImageExtension(format),
      mimeType: resolveImageMimeType(format),
      originalName: args.originalName,
      fileSize: args.buffer.byteLength,
      width,
      height,
      durationMs: null,
      previewBuffer: null,
      previewExtension: null,
      previewMimeType: null,
      inlinePlaybackBuffer: null,
      inlinePlaybackExtension: null,
      inlinePlaybackMimeType: null,
    };
  } catch (error) {
    if (error instanceof Error && error.message.trim().length > 0) {
      if (error.message.includes('Изображение слишком большое')) {
        throw error;
      }
    }

    return null;
  }
}

async function tryProcessVideoAttachment(args: {
  buffer: Buffer;
  originalName: string;
  mimeType: string | null | undefined;
  limits: DirectMessageAttachmentPipelineLimits;
}): Promise<ProcessedDirectMessageAttachment | null> {
  if (
    isDirectMessageAudioName(args.originalName) ||
    isAudioMimeType(args.mimeType)
  ) {
    return null;
  }

  const extension = resolveVideoExtension(args.originalName, args.mimeType);

  if (!extension) {
    return null;
  }

  const tempRoot = await mkdtemp(join(tmpdir(), 'lobby-dm-attachment-'));
  const inputPath = join(tempRoot, `input.${extension}`);
  const previewPath = join(tempRoot, 'preview.webp');
  const ffmpegBinaryPath = await resolveFfmpegBinaryPath();
  const ffprobeBinaryPath = await resolveFfprobeBinaryPath();

  try {
    await writeFile(inputPath, args.buffer);

    const stdout = await runBinary(ffprobeBinaryPath, [
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
    const hasAudio = Boolean(
      payload.streams?.some((stream) => stream.codec_type === 'audio'),
    );
    const width = videoStream?.width ?? 0;
    const height = videoStream?.height ?? 0;
    const durationMs = payload.format?.duration
      ? Math.round(Number.parseFloat(payload.format.duration) * 1000)
      : null;

    if (!width || !height) {
      throw new Error('Не удалось определить размеры видео.');
    }

    if (
      width > args.limits.maxVideoDimension ||
      height > args.limits.maxVideoDimension
    ) {
      throw new Error(
        `Видео слишком большое. Максимум ${args.limits.maxVideoDimension}px по большей стороне.`,
      );
    }

    if (durationMs !== null && durationMs > args.limits.maxVideoDurationMs) {
      throw new Error(
        `Видео длиннее ${Math.round(args.limits.maxVideoDurationMs / 1000)} секунд.`,
      );
    }

    let assetBuffer = args.buffer;
    let assetExtension: 'mp4' | 'webm' = extension;
    let assetMimeType = resolveVideoMimeType(extension, args.mimeType);
    let assetOriginalName = args.originalName;
    let assetWidth = width;
    let assetHeight = height;
    let previewSourcePath = inputPath;
    let inlinePlaybackBuffer: Buffer | null = null;
    let inlinePlaybackExtension: 'mp4' | null = null;
    let inlinePlaybackMimeType: 'video/mp4' | null = null;

    if (isDirectMessageVideoNoteName(args.originalName)) {
      const primaryAssetPath = join(tempRoot, 'asset.mp4');
      const inlinePlaybackPath = join(tempRoot, 'inline-playback.mp4');
      const primaryDimensions = resolveVideoNoteOutputDimensions(
        width,
        height,
        primaryVideoNoteTranscodeProfile.maxDimension,
      );
      const inlinePlaybackDimensions = resolveVideoNoteOutputDimensions(
        width,
        height,
        inlineVideoNoteTranscodeProfile.maxDimension,
      );

      await transcodeVideoNoteAttachment({
        ffmpegBinaryPath,
        inputPath,
        outputPath: primaryAssetPath,
        width: primaryDimensions.width,
        height: primaryDimensions.height,
        hasAudio,
        profile: primaryVideoNoteTranscodeProfile,
      });
      await transcodeVideoNoteAttachment({
        ffmpegBinaryPath,
        inputPath,
        outputPath: inlinePlaybackPath,
        width: inlinePlaybackDimensions.width,
        height: inlinePlaybackDimensions.height,
        hasAudio,
        profile: inlineVideoNoteTranscodeProfile,
      });

      assetBuffer = await readFile(primaryAssetPath);
      assetExtension = 'mp4';
      assetMimeType = 'video/mp4';
      assetOriginalName = replaceFileExtension(args.originalName, 'mp4');
      assetWidth = primaryDimensions.width;
      assetHeight = primaryDimensions.height;
      previewSourcePath = primaryAssetPath;
      inlinePlaybackBuffer = await readFile(inlinePlaybackPath);
      inlinePlaybackExtension = 'mp4';
      inlinePlaybackMimeType = 'video/mp4';
    }

    await runBinary(ffmpegBinaryPath, [
      '-y',
      '-i',
      previewSourcePath,
      '-frames:v',
      '1',
      '-vf',
      'scale=640:-1:force_original_aspect_ratio=decrease',
      previewPath,
    ]);
    const previewBuffer = await readFile(previewPath);

    return {
      kind: 'VIDEO',
      assetBuffer,
      extension: assetExtension,
      mimeType: assetMimeType,
      originalName: assetOriginalName,
      fileSize: assetBuffer.byteLength,
      width: assetWidth,
      height: assetHeight,
      durationMs,
      previewBuffer,
      previewExtension: 'webp',
      previewMimeType: 'image/webp',
      inlinePlaybackBuffer,
      inlinePlaybackExtension,
      inlinePlaybackMimeType,
    };
  } finally {
    await rm(tempRoot, {
      force: true,
      recursive: true,
    });
  }
}

function processDocumentAttachment(args: {
  buffer: Buffer;
  originalName: string;
  mimeType: string | null | undefined;
}): ProcessedDirectMessageAttachment {
  const normalizedMimeType = args.mimeType?.trim().toLowerCase() ?? '';
  const extension = extname(args.originalName).slice(1).toLowerCase();

  if (
    !documentMimeTypes.has(normalizedMimeType) &&
    !documentExtensions.has(extension)
  ) {
    throw new Error(
      'Поддерживаются фото, видео и документы популярных форматов.',
    );
  }

  return {
    kind: 'DOCUMENT',
    assetBuffer: args.buffer,
    extension: extension || 'bin',
    mimeType: normalizedMimeType || 'application/octet-stream',
    originalName: args.originalName,
    fileSize: args.buffer.byteLength,
    width: null,
    height: null,
    durationMs: null,
    previewBuffer: null,
    previewExtension: null,
    previewMimeType: null,
    inlinePlaybackBuffer: null,
    inlinePlaybackExtension: null,
    inlinePlaybackMimeType: null,
  };
}

function normalizeOriginalName(
  originalName: string | null | undefined,
  mimeType: string | null | undefined,
): string {
  const trimmed = originalName?.trim();

  if (trimmed) {
    return trimmed.slice(0, 255);
  }

  const extension =
    resolveVideoExtension('', mimeType) ??
    resolveFallbackExtensionFromMimeType(mimeType);

  return `attachment.${extension}`;
}

function resolveFallbackExtensionFromMimeType(
  mimeType: string | null | undefined,
): string {
  const normalized = mimeType?.trim().toLowerCase() ?? '';

  switch (normalized) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    case 'video/mp4':
      return 'mp4';
    case 'video/webm':
      return 'webm';
    case 'audio/mpeg':
    case 'audio/mp3':
      return 'mp3';
    case 'audio/mp4':
      return 'm4a';
    case 'audio/ogg':
      return 'ogg';
    case 'audio/webm':
      return 'webm';
    case 'audio/wav':
    case 'audio/x-wav':
      return 'wav';
    case 'application/pdf':
      return 'pdf';
    default:
      return 'bin';
  }
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
      throw new Error('Поддерживаются PNG, JPG, JPEG, WEBP и GIF.');
  }
}

function resolveVideoExtension(
  originalName: string,
  mimeType: string | null | undefined,
): 'mp4' | 'webm' | null {
  const normalizedName = originalName.trim().toLowerCase();
  const normalizedMime = mimeType?.trim().toLowerCase() ?? '';

  if (
    normalizedMime.startsWith('video/mp4') ||
    normalizedName.endsWith('.mp4')
  ) {
    return 'mp4';
  }

  if (
    normalizedMime.startsWith('video/webm') ||
    normalizedName.endsWith('.webm')
  ) {
    return 'webm';
  }

  return null;
}

function resolveVideoMimeType(
  extension: 'mp4' | 'webm',
  mimeType: string | null | undefined,
): string {
  if (mimeType && mimeType.trim().length > 0) {
    return mimeType;
  }

  return extension === 'mp4' ? 'video/mp4' : 'video/webm';
}

function isDirectMessageVideoNoteName(originalName: string): boolean {
  return originalName.trim().toLowerCase().startsWith(videoNoteFilePrefix);
}

function isDirectMessageAudioName(originalName: string): boolean {
  return originalName.trim().toLowerCase().startsWith(voiceNoteFilePrefix);
}

function isAudioMimeType(mimeType: string | null | undefined): boolean {
  return (mimeType?.trim().toLowerCase() ?? '').startsWith('audio/');
}

function replaceFileExtension(
  originalName: string,
  nextExtension: string,
): string {
  const trimmed = originalName.trim();
  const baseName = trimmed.replace(/\.[^.]+$/, '');

  return `${baseName || 'attachment'}.${nextExtension}`;
}

function resolveVideoNoteOutputDimensions(
  width: number,
  height: number,
  maxDimension: number,
) {
  const scale = Math.min(1, maxDimension / Math.max(width, height));

  return {
    width: toEvenDimension(width * scale),
    height: toEvenDimension(height * scale),
  };
}

function toEvenDimension(value: number): number {
  const rounded = Math.max(2, Math.round(value));
  return rounded % 2 === 0 ? rounded : rounded - 1;
}

async function transcodeVideoNoteAttachment(args: {
  ffmpegBinaryPath: string;
  inputPath: string;
  outputPath: string;
  width: number;
  height: number;
  hasAudio: boolean;
  profile: VideoNoteTranscodeProfile;
}): Promise<void> {
  await runBinary(args.ffmpegBinaryPath, [
    '-y',
    '-i',
    args.inputPath,
    '-map_metadata',
    '-1',
    '-map_chapters',
    '-1',
    '-map',
    '0:v:0',
    ...(args.hasAudio ? ['-map', '0:a:0'] : []),
    '-vf',
    `scale=${args.width}:${args.height}:flags=lanczos,fps=${args.profile.targetFps}`,
    '-c:v',
    'libx264',
    '-preset',
    args.profile.preset,
    '-profile:v',
    args.profile.h264Profile,
    '-level',
    args.profile.level,
    '-pix_fmt',
    'yuv420p',
    '-crf',
    String(args.profile.crf),
    '-maxrate',
    `${args.profile.maxRateKbps}k`,
    '-bufsize',
    `${args.profile.bufferKbps}k`,
    '-g',
    String(args.profile.targetFps * 2),
    '-keyint_min',
    String(args.profile.targetFps * 2),
    '-sc_threshold',
    '0',
    ...(args.hasAudio
      ? [
          '-c:a',
          'aac',
          '-b:a',
          `${args.profile.audioBitrateKbps}k`,
          '-ac',
          '1',
          '-ar',
          '48000',
        ]
      : ['-an']),
    '-movflags',
    '+faststart',
    args.outputPath,
  ]);
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
      const errorCode =
        error && typeof error === 'object' && 'code' in error
          ? String(error.code)
          : null;
      reject(
        errorCode === 'ENOENT'
          ? new Error(
              `Не удалось запустить ${binaryPath}. Проверьте FFMPEG_PATH/FFPROBE_PATH или системный PATH.`,
            )
          : error,
      );
    });
    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }

      reject(
        new Error(stderr.trim() || `${binaryPath} exited with code ${code}`),
      );
    });
  });
}
