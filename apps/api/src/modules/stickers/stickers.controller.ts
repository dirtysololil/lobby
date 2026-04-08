import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  adminStickerPacksResponseSchema,
  createStickerPackSchema,
  discoverStickerPacksQuerySchema,
  discoverStickerPacksResponseSchema,
  reorderStickerPacksSchema,
  reorderStickersSchema,
  setStickerPackCoverSchema,
  stickerActionResponseSchema,
  stickerCatalogResponseSchema,
  stickerPackResponseSchema,
  stickerResponseSchema,
  type CreateStickerPackInput,
  type DiscoverStickerPacksQuery,
  type PublicUser,
  type ReorderStickerPacksInput,
  type ReorderStickersInput,
  type SetStickerPackCoverInput,
  type UpdateStickerInput,
  type UpdateStickerPackInput,
  updateStickerPackSchema,
  updateStickerSchema,
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
  mimetype?: string;
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
  @Get('discover')
  public async discoverPacks(
    @CurrentUser() currentUser: PublicUser,
    @Query('query') query?: string,
  ) {
    const parsed = discoverStickerPacksQuerySchema.parse({
      query: typeof query === 'string' ? query : '',
    } satisfies DiscoverStickerPacksQuery);

    return discoverStickerPacksResponseSchema.parse({
      packs: await this.stickersService.discoverPacks(
        currentUser.id,
        parsed.query,
      ),
    });
  }

  @RequireAuth()
  @Post('packs/:packId/install')
  public async installPack(
    @CurrentUser() currentUser: PublicUser,
    @Param('packId') packId: string,
  ) {
    await this.stickersService.installPackForUser(currentUser.id, packId);

    return stickerActionResponseSchema.parse({
      ok: true,
    });
  }

  @RequireAuth()
  @Delete('packs/:packId/install')
  public async uninstallPack(
    @CurrentUser() currentUser: PublicUser,
    @Param('packId') packId: string,
  ) {
    await this.stickersService.uninstallPackForUser(currentUser.id, packId);

    return stickerActionResponseSchema.parse({
      ok: true,
    });
  }

  @RequireAuth('OWNER', 'ADMIN')
  @Get('admin/packs')
  public async listAdminPacks() {
    return adminStickerPacksResponseSchema.parse({
      packs: await this.stickersService.listAdminPacks(),
    });
  }

  @RequireAuth('OWNER', 'ADMIN')
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

  @RequireAuth('OWNER', 'ADMIN')
  @Patch('packs/:packId')
  public async updatePack(
    @CurrentUser() currentUser: PublicUser,
    @Param('packId') packId: string,
    @Body(new ZodValidationPipe(updateStickerPackSchema))
    body: UpdateStickerPackInput,
    @Req() request: AuthenticatedRequest,
  ) {
    return stickerPackResponseSchema.parse({
      pack: await this.stickersService.updatePack(
        currentUser.id,
        packId,
        body,
        getRequestMetadata(request),
      ),
    });
  }

  @RequireAuth('OWNER', 'ADMIN')
  @Post('packs/:packId/cover')
  public async setPackCover(
    @CurrentUser() currentUser: PublicUser,
    @Param('packId') packId: string,
    @Body(new ZodValidationPipe(setStickerPackCoverSchema))
    body: SetStickerPackCoverInput,
    @Req() request: AuthenticatedRequest,
  ) {
    return stickerPackResponseSchema.parse({
      pack: await this.stickersService.setPackCover(
        currentUser.id,
        packId,
        body,
        getRequestMetadata(request),
      ),
    });
  }

  @RequireAuth('OWNER', 'ADMIN')
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

  @RequireAuth('OWNER', 'ADMIN')
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

  @RequireAuth('OWNER', 'ADMIN')
  @Post('packs/:packId/stickers')
  @UseInterceptors(FileInterceptor('file'))
  public async uploadSticker(
    @CurrentUser() currentUser: PublicUser,
    @Param('packId') packId: string,
    @UploadedFile() file: UploadedBinaryFile | undefined,
    @Body()
    body:
      | {
          title?: string;
          keywords?: string | string[];
          crop?: string;
          published?: string;
        }
      | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return stickerResponseSchema.parse({
      sticker: await this.stickersService.addStickerToPack(
        currentUser.id,
        packId,
        file,
        body?.title,
        normalizeKeywords(body?.keywords),
        parseCropPayload(body?.crop),
        body?.published === 'true',
        getRequestMetadata(request),
      ),
    });
  }

  @RequireAuth('OWNER', 'ADMIN')
  @Patch('packs/:packId/stickers/:stickerId')
  public async updateSticker(
    @CurrentUser() currentUser: PublicUser,
    @Param('packId') packId: string,
    @Param('stickerId') stickerId: string,
    @Body(new ZodValidationPipe(updateStickerSchema))
    body: UpdateStickerInput,
    @Req() request: AuthenticatedRequest,
  ) {
    return stickerResponseSchema.parse({
      sticker: await this.stickersService.updateSticker(
        currentUser.id,
        packId,
        stickerId,
        body,
        getRequestMetadata(request),
      ),
    });
  }

  @RequireAuth('OWNER', 'ADMIN')
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

  @RequireAuth('OWNER', 'ADMIN')
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

function normalizeKeywords(value: string | string[] | undefined): string[] {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .flatMap((item) => item.split(','))
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseCropPayload(value: string | undefined) {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as {
      scale?: number;
      translateX?: number;
      translateY?: number;
    };

    return parsed;
  } catch {
    return null;
  }
}
