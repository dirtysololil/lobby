import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  adminMediaLibraryResponseSchema,
  createCustomEmojiSchema,
  createGifAssetSchema,
  customEmojiResponseSchema,
  gifAssetResponseSchema,
  mediaActionResponseSchema,
  mediaPickerCatalogResponseSchema,
  reorderCustomEmojisSchema,
  reorderGifAssetsSchema,
  type PublicUser,
  type ReorderCustomEmojisInput,
  type ReorderGifAssetsInput,
  type UpdateCustomEmojiInput,
  type UpdateGifAssetInput,
  updateCustomEmojiSchema,
  updateGifAssetSchema,
} from '@lobby/shared';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireAuth } from '../../common/decorators/require-auth.decorator';
import type { AuthenticatedRequest } from '../../common/interfaces/authenticated-request.interface';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { getRequestMetadata } from '../../common/utils/request-metadata.util';
import { MediaLibraryService } from './media-library.service';

type UploadedBinaryFile = {
  buffer: Buffer;
  size: number;
  originalname: string;
};

@Controller()
export class MediaLibraryController {
  public constructor(
    private readonly mediaLibraryService: MediaLibraryService,
  ) {}

  @RequireAuth()
  @Get('media/picker')
  public async getPickerCatalog(@CurrentUser() currentUser: PublicUser) {
    return mediaPickerCatalogResponseSchema.parse({
      catalog: await this.mediaLibraryService.getPickerCatalog(currentUser.id),
    });
  }

  @RequireAuth()
  @Get('media/custom-emojis/:emojiId/asset')
  public async streamCustomEmoji(
    @CurrentUser() currentUser: PublicUser,
    @Param('emojiId') emojiId: string,
    @Res() response: Response,
  ) {
    const asset = await this.mediaLibraryService.getCustomEmojiAssetForViewer(
      currentUser.id,
      emojiId,
    );
    response.setHeader('Content-Type', asset.mimeType);
    response.setHeader('Cache-Control', 'private, max-age=300');

    return response.send(asset.buffer);
  }

  @RequireAuth()
  @Get('media/gifs/:gifId/asset')
  public async streamGif(
    @CurrentUser() currentUser: PublicUser,
    @Param('gifId') gifId: string,
    @Res() response: Response,
  ) {
    const asset = await this.mediaLibraryService.getGifAssetForViewer(
      currentUser.id,
      gifId,
    );
    response.setHeader('Content-Type', asset.mimeType);
    response.setHeader('Cache-Control', 'private, max-age=300');

    return response.send(asset.buffer);
  }

  @RequireAuth('OWNER', 'ADMIN')
  @Get('admin/media/library')
  public async getAdminLibrary() {
    return adminMediaLibraryResponseSchema.parse({
      library: await this.mediaLibraryService.listAdminLibrary(),
    });
  }

  @RequireAuth('OWNER', 'ADMIN')
  @Post('admin/media/emojis')
  @UseInterceptors(FileInterceptor('file'))
  public async createCustomEmoji(
    @CurrentUser() currentUser: PublicUser,
    @UploadedFile() file: UploadedBinaryFile | undefined,
    @Body() body: { alias?: string; title?: string } | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    const parsed = createCustomEmojiSchema.parse({
      alias: typeof body?.alias === 'string' ? body.alias : '',
      title: typeof body?.title === 'string' ? body.title : undefined,
    });

    return customEmojiResponseSchema.parse({
      emoji: await this.mediaLibraryService.createCustomEmoji(
        currentUser.id,
        parsed,
        file,
        getRequestMetadata(request),
      ),
    });
  }

  @RequireAuth('OWNER', 'ADMIN')
  @Patch('admin/media/emojis/:emojiId')
  public async updateCustomEmoji(
    @CurrentUser() currentUser: PublicUser,
    @Param('emojiId') emojiId: string,
    @Body(new ZodValidationPipe(updateCustomEmojiSchema))
    body: UpdateCustomEmojiInput,
    @Req() request: AuthenticatedRequest,
  ) {
    return customEmojiResponseSchema.parse({
      emoji: await this.mediaLibraryService.updateCustomEmoji(
        currentUser.id,
        emojiId,
        body,
        getRequestMetadata(request),
      ),
    });
  }

  @RequireAuth('OWNER', 'ADMIN')
  @Post('admin/media/emojis/reorder')
  public async reorderCustomEmojis(
    @CurrentUser() currentUser: PublicUser,
    @Body(new ZodValidationPipe(reorderCustomEmojisSchema))
    body: ReorderCustomEmojisInput,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.mediaLibraryService.reorderCustomEmojis(
      currentUser.id,
      body,
      getRequestMetadata(request),
    );

    return mediaActionResponseSchema.parse({
      ok: true,
    });
  }

  @RequireAuth('OWNER', 'ADMIN')
  @Delete('admin/media/emojis/:emojiId')
  public async deleteCustomEmoji(
    @CurrentUser() currentUser: PublicUser,
    @Param('emojiId') emojiId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.mediaLibraryService.deleteCustomEmoji(
      currentUser.id,
      emojiId,
      getRequestMetadata(request),
    );

    return mediaActionResponseSchema.parse({
      ok: true,
    });
  }

  @RequireAuth('OWNER', 'ADMIN')
  @Post('admin/media/gifs')
  @UseInterceptors(FileInterceptor('file'))
  public async createGifAsset(
    @CurrentUser() currentUser: PublicUser,
    @UploadedFile() file: UploadedBinaryFile | undefined,
    @Body() body: { title?: string; tags?: string | string[] } | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    const parsed = createGifAssetSchema.parse({
      title: typeof body?.title === 'string' ? body.title : '',
      tags: normalizeTags(body?.tags),
    });

    return gifAssetResponseSchema.parse({
      gif: await this.mediaLibraryService.createGifAsset(
        currentUser.id,
        parsed,
        file,
        getRequestMetadata(request),
      ),
    });
  }

  @RequireAuth('OWNER', 'ADMIN')
  @Patch('admin/media/gifs/:gifId')
  public async updateGifAsset(
    @CurrentUser() currentUser: PublicUser,
    @Param('gifId') gifId: string,
    @Body(new ZodValidationPipe(updateGifAssetSchema))
    body: UpdateGifAssetInput,
    @Req() request: AuthenticatedRequest,
  ) {
    return gifAssetResponseSchema.parse({
      gif: await this.mediaLibraryService.updateGifAsset(
        currentUser.id,
        gifId,
        body,
        getRequestMetadata(request),
      ),
    });
  }

  @RequireAuth('OWNER', 'ADMIN')
  @Post('admin/media/gifs/reorder')
  public async reorderGifAssets(
    @CurrentUser() currentUser: PublicUser,
    @Body(new ZodValidationPipe(reorderGifAssetsSchema))
    body: ReorderGifAssetsInput,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.mediaLibraryService.reorderGifAssets(
      currentUser.id,
      body,
      getRequestMetadata(request),
    );

    return mediaActionResponseSchema.parse({
      ok: true,
    });
  }

  @RequireAuth('OWNER', 'ADMIN')
  @Delete('admin/media/gifs/:gifId')
  public async deleteGifAsset(
    @CurrentUser() currentUser: PublicUser,
    @Param('gifId') gifId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.mediaLibraryService.deleteGifAsset(
      currentUser.id,
      gifId,
      getRequestMetadata(request),
    );

    return mediaActionResponseSchema.parse({
      ok: true,
    });
  }
}

function normalizeTags(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => normalizeTags(item))
      .slice(0, 12);
  }

  if (!value) {
    return [];
  }

  return value
    .split(/[\n,]/g)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);
}
