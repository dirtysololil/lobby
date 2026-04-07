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
  createStickerPackSchema,
  renameStickerPackSchema,
  reorderStickerPacksSchema,
  reorderStickersSchema,
  stickerActionResponseSchema,
  stickerCatalogResponseSchema,
  stickerPackResponseSchema,
  stickerResponseSchema,
  type CreateStickerPackInput,
  type PublicUser,
  type RenameStickerPackInput,
  type ReorderStickerPacksInput,
  type ReorderStickersInput,
} from '@lobby/shared';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireAuth } from '../../common/decorators/require-auth.decorator';
import type { AuthenticatedRequest } from '../../common/interfaces/authenticated-request.interface';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { getRequestMetadata } from '../../common/utils/request-metadata.util';
import { StickersService } from './stickers.service';

type UploadedBinaryFile = {
  buffer: Buffer;
  size: number;
  originalname: string;
};

@Controller('stickers')
export class StickersController {
  public constructor(private readonly stickersService: StickersService) {}

  @RequireAuth()
  @Get('me')
  public async getCatalog(@CurrentUser() currentUser: PublicUser) {
    return stickerCatalogResponseSchema.parse({
      catalog: await this.stickersService.getCatalogForUser(currentUser.id),
    });
  }

  @RequireAuth()
  @Post('packs')
  public async createPack(
    @CurrentUser() currentUser: PublicUser,
    @Body(new ZodValidationPipe(createStickerPackSchema))
    body: CreateStickerPackInput,
    @Req() request: AuthenticatedRequest,
  ) {
    return stickerPackResponseSchema.parse({
      pack: await this.stickersService.createPack(
        currentUser.id,
        body,
        getRequestMetadata(request),
      ),
    });
  }

  @RequireAuth()
  @Patch('packs/:packId')
  public async renamePack(
    @CurrentUser() currentUser: PublicUser,
    @Param('packId') packId: string,
    @Body(new ZodValidationPipe(renameStickerPackSchema))
    body: RenameStickerPackInput,
    @Req() request: AuthenticatedRequest,
  ) {
    return stickerPackResponseSchema.parse({
      pack: await this.stickersService.renamePack(
        currentUser.id,
        packId,
        body,
        getRequestMetadata(request),
      ),
    });
  }

  @RequireAuth()
  @Post('packs/reorder')
  public async reorderPacks(
    @CurrentUser() currentUser: PublicUser,
    @Body(new ZodValidationPipe(reorderStickerPacksSchema))
    body: ReorderStickerPacksInput,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.stickersService.reorderPacks(
      currentUser.id,
      body,
      getRequestMetadata(request),
    );

    return stickerActionResponseSchema.parse({
      ok: true,
    });
  }

  @RequireAuth()
  @Delete('packs/:packId')
  public async deletePack(
    @CurrentUser() currentUser: PublicUser,
    @Param('packId') packId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.stickersService.deletePack(
      currentUser.id,
      packId,
      getRequestMetadata(request),
    );

    return stickerActionResponseSchema.parse({
      ok: true,
    });
  }

  @RequireAuth()
  @Post('packs/:packId/stickers')
  @UseInterceptors(FileInterceptor('file'))
  public async uploadSticker(
    @CurrentUser() currentUser: PublicUser,
    @Param('packId') packId: string,
    @UploadedFile() file: UploadedBinaryFile | undefined,
    @Body() body: { title?: string } | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return stickerResponseSchema.parse({
      sticker: await this.stickersService.addStickerToPack(
        currentUser.id,
        packId,
        file,
        body?.title,
        getRequestMetadata(request),
      ),
    });
  }

  @RequireAuth()
  @Post('packs/:packId/stickers/reorder')
  public async reorderStickers(
    @CurrentUser() currentUser: PublicUser,
    @Param('packId') packId: string,
    @Body(new ZodValidationPipe(reorderStickersSchema))
    body: ReorderStickersInput,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.stickersService.reorderStickers(
      currentUser.id,
      packId,
      body,
      getRequestMetadata(request),
    );

    return stickerActionResponseSchema.parse({
      ok: true,
    });
  }

  @RequireAuth()
  @Delete('packs/:packId/stickers/:stickerId')
  public async deleteSticker(
    @CurrentUser() currentUser: PublicUser,
    @Param('packId') packId: string,
    @Param('stickerId') stickerId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.stickersService.deleteSticker(
      currentUser.id,
      packId,
      stickerId,
      getRequestMetadata(request),
    );

    return stickerActionResponseSchema.parse({
      ok: true,
    });
  }

  @RequireAuth()
  @Get(':stickerId/asset')
  public async streamSticker(
    @CurrentUser() currentUser: PublicUser,
    @Param('stickerId') stickerId: string,
    @Res() response: Response,
  ) {
    const asset = await this.stickersService.getStickerAssetForViewer(
      currentUser.id,
      stickerId,
    );
    response.setHeader('Content-Type', asset.mimeType);
    response.setHeader('Cache-Control', 'private, max-age=300');

    return response.send(asset.buffer);
  }
}
