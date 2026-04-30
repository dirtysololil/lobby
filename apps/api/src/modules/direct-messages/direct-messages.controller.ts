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
  actionMessageSchema,
  createDirectMessageSchema,
  directConversationDetailSchema,
  directMessageAttachmentUploadResponseSchema,
  directConversationListResponseSchema,
  directConversationSummaryResponseSchema,
  directMessageResponseSchema,
  openDirectConversationSchema,
  reactionMutationSchema,
  uploadDirectMessageAttachmentSchema,
  updateDmSettingsSchema,
  type CreateDirectMessageInput,
  type OpenDirectConversationInput,
  type PublicUser,
  type ReactionMutationInput,
  type UpdateDmSettingsInput,
} from '@lobby/shared';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireAuth } from '../../common/decorators/require-auth.decorator';
import type { AuthenticatedRequest } from '../../common/interfaces/authenticated-request.interface';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { getRequestMetadata } from '../../common/utils/request-metadata.util';
import { DirectMessagesService } from './direct-messages.service';

type UploadedBinaryFile = {
  buffer: Buffer;
  size: number;
  originalname: string;
  mimetype?: string;
};

@Controller('direct-messages')
export class DirectMessagesController {
  public constructor(
    private readonly directMessagesService: DirectMessagesService,
  ) {}

  @RequireAuth()
  @Get()
  public async listConversations(@CurrentUser() currentUser: PublicUser) {
    const items = await this.directMessagesService.listConversations(
      currentUser.id,
    );

    return directConversationListResponseSchema.parse({
      items,
    });
  }

  @RequireAuth()
  @Post('open')
  public async openConversation(
    @CurrentUser() currentUser: PublicUser,
    @Body(new ZodValidationPipe(openDirectConversationSchema))
    body: OpenDirectConversationInput,
    @Req() request: AuthenticatedRequest,
  ) {
    const conversation = await this.directMessagesService.openConversation(
      currentUser,
      body.username,
      getRequestMetadata(request),
    );

    return directConversationSummaryResponseSchema.parse({
      conversation,
    });
  }

  @RequireAuth()
  @Get(':conversationId')
  public async getConversation(
    @CurrentUser() currentUser: PublicUser,
    @Param('conversationId') conversationId: string,
  ) {
    return directConversationDetailSchema.parse(
      await this.directMessagesService.getConversationDetail(
        currentUser.id,
        conversationId,
      ),
    );
  }

  @RequireAuth()
  @Post(':conversationId/messages')
  public async createMessage(
    @CurrentUser() currentUser: PublicUser,
    @Param('conversationId') conversationId: string,
    @Body(new ZodValidationPipe(createDirectMessageSchema))
    body: CreateDirectMessageInput,
    @Req() request: AuthenticatedRequest,
  ) {
    const message = await this.directMessagesService.createMessage(
      currentUser,
      conversationId,
      body,
      getRequestMetadata(request),
    );

    return directMessageResponseSchema.parse({
      message,
    });
  }

  @RequireAuth()
  @Post(':conversationId/messages/:messageId/reactions')
  public async toggleMessageReaction(
    @CurrentUser() currentUser: PublicUser,
    @Param('conversationId') conversationId: string,
    @Param('messageId') messageId: string,
    @Body(new ZodValidationPipe(reactionMutationSchema))
    body: ReactionMutationInput,
    @Req() request: AuthenticatedRequest,
  ) {
    const message = await this.directMessagesService.toggleMessageReaction(
      currentUser,
      conversationId,
      messageId,
      body,
      getRequestMetadata(request),
    );

    return directMessageResponseSchema.parse({
      message,
    });
  }

  @RequireAuth()
  @Post(':conversationId/attachments')
  @UseInterceptors(FileInterceptor('file'))
  public async uploadAttachment(
    @CurrentUser() currentUser: PublicUser,
    @Param('conversationId') conversationId: string,
    @UploadedFile() file: UploadedBinaryFile | undefined,
    @Body()
    body:
      | { clientNonce?: string; replyToMessageId?: string | null }
      | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    const parsed = uploadDirectMessageAttachmentSchema.parse({
      clientNonce:
        typeof body?.clientNonce === 'string' ? body.clientNonce : undefined,
      replyToMessageId:
        typeof body?.replyToMessageId === 'string'
          ? body.replyToMessageId
          : undefined,
    });
    const message = await this.directMessagesService.createAttachmentMessage(
      currentUser,
      conversationId,
      parsed,
      file,
      getRequestMetadata(request),
    );

    return directMessageAttachmentUploadResponseSchema.parse({
      message,
    });
  }

  @RequireAuth()
  @Get('attachments/:attachmentId/stream')
  public async streamAttachmentInlinePlayback(
    @CurrentUser() currentUser: PublicUser,
    @Param('attachmentId') attachmentId: string,
    @Req() request: AuthenticatedRequest,
    @Res() response: Response,
  ) {
    const asset =
      await this.directMessagesService.getAttachmentInlinePlaybackDescriptorForViewer(
        currentUser.id,
        attachmentId,
      );
    const byteRange = parseSingleByteRange(request.headers.range, asset.size);

    if (request.headers.range && !byteRange) {
      response.status(416);
      response.setHeader('Content-Range', `bytes */${asset.size}`);
      return response.end();
    }

    response.setHeader('Accept-Ranges', 'bytes');
    response.setHeader('Content-Type', asset.mimeType);
    response.setHeader(
      'Cache-Control',
      asset.isInlinePlayback
        ? 'private, max-age=31536000, immutable'
        : 'private, max-age=30, must-revalidate',
    );

    if (byteRange) {
      const chunk = await this.directMessagesService.readAttachmentAssetRange(
        asset.fileKey,
        byteRange.start,
        byteRange.end,
      );

      response.status(206);
      response.setHeader(
        'Content-Range',
        `bytes ${byteRange.start}-${byteRange.end}/${asset.size}`,
      );
      response.setHeader('Content-Length', String(chunk.byteLength));

      return response.send(chunk);
    }

    const fullAsset = await this.directMessagesService.readAttachmentAsset(
      asset.fileKey,
    );
    response.setHeader('Content-Length', String(asset.size));

    return response.send(fullAsset);
  }

  @RequireAuth()
  @Get('attachments/:attachmentId/asset')
  public async streamAttachmentAsset(
    @CurrentUser() currentUser: PublicUser,
    @Param('attachmentId') attachmentId: string,
    @Req() request: AuthenticatedRequest,
    @Res() response: Response,
  ) {
    const asset =
      await this.directMessagesService.getAttachmentAssetDescriptorForViewer(
        currentUser.id,
        attachmentId,
        'asset',
      );
    const byteRange = parseSingleByteRange(request.headers.range, asset.size);

    if (request.headers.range && !byteRange) {
      response.status(416);
      response.setHeader('Content-Range', `bytes */${asset.size}`);
      return response.end();
    }

    response.setHeader('Accept-Ranges', 'bytes');
    response.setHeader('Content-Type', asset.mimeType);
    response.setHeader('Cache-Control', 'private, max-age=31536000, immutable');

    if (byteRange) {
      const chunk = await this.directMessagesService.readAttachmentAssetRange(
        asset.fileKey,
        byteRange.start,
        byteRange.end,
      );

      response.status(206);
      response.setHeader(
        'Content-Range',
        `bytes ${byteRange.start}-${byteRange.end}/${asset.size}`,
      );
      response.setHeader('Content-Length', String(chunk.byteLength));

      return response.send(chunk);
    }

    const fullAsset = await this.directMessagesService.readAttachmentAsset(
      asset.fileKey,
    );
    response.setHeader('Content-Length', String(asset.size));

    return response.send(fullAsset);
  }

  @RequireAuth()
  @Get('attachments/:attachmentId/download')
  public async downloadAttachmentAsset(
    @CurrentUser() currentUser: PublicUser,
    @Param('attachmentId') attachmentId: string,
    @Res() response: Response,
  ) {
    const asset =
      await this.directMessagesService.getAttachmentAssetDescriptorForViewer(
        currentUser.id,
        attachmentId,
        'asset',
      );
    const fullAsset = await this.directMessagesService.readAttachmentAsset(
      asset.fileKey,
    );

    response.setHeader('Content-Type', asset.mimeType);
    response.setHeader('Content-Length', String(asset.size));
    response.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    response.setHeader(
      'Content-Disposition',
      buildAttachmentContentDisposition(asset.originalName),
    );

    return response.send(fullAsset);
  }

  @RequireAuth()
  @Get('attachments/:attachmentId/preview')
  public async streamAttachmentPreview(
    @CurrentUser() currentUser: PublicUser,
    @Param('attachmentId') attachmentId: string,
    @Res() response: Response,
  ) {
    const asset = await this.directMessagesService.getAttachmentAssetForViewer(
      currentUser.id,
      attachmentId,
      'preview',
    );
    response.setHeader('Content-Type', asset.mimeType);
    response.setHeader('Cache-Control', 'private, max-age=31536000, immutable');

    return response.send(asset.buffer);
  }

  @RequireAuth()
  @Delete(':conversationId/messages/:messageId')
  public async deleteMessage(
    @CurrentUser() currentUser: PublicUser,
    @Param('conversationId') conversationId: string,
    @Param('messageId') messageId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    const message = await this.directMessagesService.deleteMessage(
      currentUser,
      conversationId,
      messageId,
      getRequestMetadata(request),
    );

    return directMessageResponseSchema.parse({
      message,
    });
  }

  @RequireAuth()
  @Post(':conversationId/read')
  public async markAsRead(
    @CurrentUser() currentUser: PublicUser,
    @Param('conversationId') conversationId: string,
  ) {
    await this.directMessagesService.markConversationAsRead(
      currentUser.id,
      conversationId,
    );

    return actionMessageSchema.parse({
      ok: true,
    });
  }

  @RequireAuth()
  @Patch(':conversationId/settings')
  public async updateSettings(
    @CurrentUser() currentUser: PublicUser,
    @Param('conversationId') conversationId: string,
    @Body(new ZodValidationPipe(updateDmSettingsSchema))
    body: UpdateDmSettingsInput,
    @Req() request: AuthenticatedRequest,
  ) {
    const conversation =
      await this.directMessagesService.updateConversationSettings(
        currentUser,
        conversationId,
        body,
        getRequestMetadata(request),
      );

    return directConversationSummaryResponseSchema.parse({
      conversation,
    });
  }
}

function parseSingleByteRange(
  rangeHeader: string | string[] | undefined,
  size: number,
): { start: number; end: number } | null {
  if (typeof rangeHeader !== 'string' || !rangeHeader.startsWith('bytes=')) {
    return null;
  }

  const [rawStart, rawEnd] = rangeHeader.slice('bytes='.length).split('-', 2);

  if (rawStart === undefined || rawEnd === undefined) {
    return null;
  }

  if (rawStart === '' && rawEnd === '') {
    return null;
  }

  const parsedStart = rawStart === '' ? null : Number.parseInt(rawStart, 10);
  const parsedEnd = rawEnd === '' ? null : Number.parseInt(rawEnd, 10);

  if (
    (parsedStart !== null && !Number.isFinite(parsedStart)) ||
    (parsedEnd !== null && !Number.isFinite(parsedEnd))
  ) {
    return null;
  }

  if (parsedStart === null) {
    const suffixLength = parsedEnd;

    if (suffixLength === null || suffixLength <= 0) {
      return null;
    }

    const start = Math.max(0, size - suffixLength);

    return {
      start,
      end: size - 1,
    };
  }

  if (parsedStart < 0 || parsedStart >= size) {
    return null;
  }

  const resolvedEnd =
    parsedEnd === null ? size - 1 : Math.min(parsedEnd, size - 1);

  if (resolvedEnd < parsedStart) {
    return null;
  }

  return {
    start: parsedStart,
    end: resolvedEnd,
  };
}

function buildAttachmentContentDisposition(originalName: string): string {
  const fallbackName =
    originalName
      .replace(/[\\\r\n"]/g, '')
      .replace(/[^\x20-\x7e]/g, '_')
      .trim() || 'attachment';
  const encodedName = encodeURIComponent(originalName).replace(
    /['()]/g,
    (value) => `%${value.charCodeAt(0).toString(16).toUpperCase()}`,
  );

  return `attachment; filename="${fallbackName}"; filename*=UTF-8''${encodedName}`;
}
