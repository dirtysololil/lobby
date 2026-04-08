import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { EnvService } from '../env/env.service';

@Injectable()
export class StorageService {
  public constructor(private readonly envService: EnvService) {}

  public async writeAvatar(buffer: Buffer, extension: string): Promise<string> {
    return this.writeScopedObject('avatars', buffer, extension);
  }

  public async writeCustomEmoji(
    buffer: Buffer,
    extension: string,
  ): Promise<string> {
    return this.writeScopedObject('custom-emojis', buffer, extension);
  }

  public async writeGif(buffer: Buffer, extension: string): Promise<string> {
    return this.writeScopedObject('gifs', buffer, extension);
  }

  public async writeRingtone(buffer: Buffer, extension: string): Promise<string> {
    return this.writeScopedObject('ringtones', buffer, extension);
  }

  public async writeSticker(buffer: Buffer, extension: string): Promise<string> {
    return this.writeScopedObject('stickers', buffer, extension);
  }

  public async writeDirectMessageAttachment(
    buffer: Buffer,
    extension: string,
  ): Promise<string> {
    return this.writeScopedObject('dm-attachments', buffer, extension);
  }

  public async writeDirectMessageAttachmentPreview(
    buffer: Buffer,
    extension: string,
  ): Promise<string> {
    return this.writeScopedObject('dm-attachment-previews', buffer, extension);
  }

  public async readObject(fileKey: string): Promise<Buffer> {
    return readFile(this.resolveLocalPath(fileKey));
  }

  public async deleteObject(fileKey: string | null | undefined): Promise<void> {
    if (!fileKey) {
      return;
    }

    await rm(this.resolveLocalPath(fileKey), { force: true });
  }

  private async writeScopedObject(
    scope: string,
    buffer: Buffer,
    extension: string,
  ): Promise<string> {
    const env = this.envService.getValues();

    if (env.UPLOAD_DRIVER !== 'local') {
      throw new ServiceUnavailableException(
        'Configured upload driver is not available in this deployment',
      );
    }

    const now = new Date();
    const fileKey = [
      scope,
      String(now.getUTCFullYear()),
      String(now.getUTCMonth() + 1).padStart(2, '0'),
      `${randomUUID()}.${extension}`,
    ].join('/');
    const absolutePath = this.resolveLocalPath(fileKey);

    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, buffer);

    return fileKey;
  }

  private resolveLocalPath(fileKey: string): string {
    const root = resolve(this.envService.getValues().UPLOAD_LOCAL_ROOT);
    const filePath = resolve(root, ...fileKey.split('/'));

    if (!filePath.startsWith(root)) {
      throw new ServiceUnavailableException('Resolved storage path is invalid');
    }

    return filePath;
  }
}
