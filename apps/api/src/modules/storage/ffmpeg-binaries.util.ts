import { constants } from 'node:fs';
import { access } from 'node:fs/promises';
import { delimiter, isAbsolute, join } from 'node:path';
import ffmpegStaticPath from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';

type BinaryName = 'ffmpeg' | 'ffprobe';

const executableCache = new Map<BinaryName, Promise<string>>();

export function resolveFfmpegBinaryPath(): Promise<string> {
  return resolveBinaryPath('ffmpeg');
}

export function resolveFfprobeBinaryPath(): Promise<string> {
  return resolveBinaryPath('ffprobe');
}

async function resolveBinaryPath(name: BinaryName): Promise<string> {
  const cached = executableCache.get(name);

  if (cached) {
    return cached;
  }

  const pending = findBinaryPath(name);
  executableCache.set(name, pending);

  try {
    return await pending;
  } catch (error) {
    executableCache.delete(name);
    throw error;
  }
}

async function findBinaryPath(name: BinaryName): Promise<string> {
  const envCandidate =
    name === 'ffmpeg'
      ? process.env.FFMPEG_PATH?.trim()
      : process.env.FFPROBE_PATH?.trim();

  const resolvedFromEnv = await resolveCandidatePath(envCandidate);

  if (resolvedFromEnv) {
    return resolvedFromEnv;
  }

  const resolvedFromSystemPath = await resolveFromSystemPath(name);

  if (resolvedFromSystemPath) {
    return resolvedFromSystemPath;
  }

  const packageFallback =
    name === 'ffmpeg'
      ? normalizeCandidateValue(ffmpegStaticPath)
      : normalizeCandidateValue(ffprobeStatic.path);
  const resolvedFromPackage = await resolveCandidatePath(packageFallback);

  if (resolvedFromPackage) {
    return resolvedFromPackage;
  }

  throw new Error(
    name === 'ffmpeg'
      ? 'Не найден ffmpeg. Укажите FFMPEG_PATH, установите системный ffmpeg/ffprobe в PATH или добавьте рабочий fallback бинарник.'
      : 'Не найден ffprobe. Укажите FFPROBE_PATH, установите системный ffmpeg/ffprobe в PATH или добавьте рабочий fallback бинарник.',
  );
}

async function resolveCandidatePath(
  candidate: string | null | undefined,
): Promise<string | null> {
  const normalizedCandidate = normalizeCandidateValue(candidate);

  if (!normalizedCandidate) {
    return null;
  }

  if (looksLikePath(normalizedCandidate)) {
    return (await canExecute(normalizedCandidate)) ? normalizedCandidate : null;
  }

  return await resolveFromSystemPath(normalizedCandidate);
}

async function resolveFromSystemPath(command: string): Promise<string | null> {
  const pathValue = process.env.PATH?.trim();

  if (!pathValue) {
    return null;
  }

  const pathEntries = pathValue
    .split(delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean);
  const suffixes =
    process.platform === 'win32'
      ? (process.env.PATHEXT?.split(';').map((entry) => entry.trim()) ?? [
          '.exe',
          '.cmd',
          '.bat',
        ])
      : [''];

  for (const entry of pathEntries) {
    for (const suffix of suffixes) {
      const nextPath = join(entry, `${command}${suffix}`);

      if (await canExecute(nextPath)) {
        return nextPath;
      }
    }
  }

  return null;
}

async function canExecute(filePath: string): Promise<boolean> {
  try {
    await access(
      filePath,
      process.platform === 'win32' ? constants.F_OK : constants.X_OK,
    );
    return true;
  } catch {
    return false;
  }
}

function looksLikePath(value: string): boolean {
  return isAbsolute(value) || value.includes('/') || value.includes('\\');
}

function normalizeCandidateValue(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
