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
  uploadDirectMessageAttachmentSchema,
  updateDmSettingsSchema,
  type CreateDirectMessageInput,
  type OpenDirectConversationInput,
  type PublicUser,
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
  @Post(':conversationId/attachments')
  @UseInterceptors(FileInterceptor('file'))
  public async uploadAttachment(
    @CurrentUser() currentUser: PublicUser,
    @Param('conversationId') conversationId: string,
    @UploadedFile() file: UploadedBinaryFile | undefined,
    @Body() body: { clientNonce?: string } | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    const parsed = uploadDirectMessageAttachmentSchema.parse({
      clientNonce:
        typeof body?.clientNonce === 'string' ? body.clientNonce : undefined,
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
  @Get('attachments/:attachmentId/asset')
  public async streamAttachmentAsset(
    @CurrentUser() currentUser: PublicUser,
    @Param('attachmentId') attachmentId: string,
    @Res() response: Response,
  ) {
    const asset = await this.directMessagesService.getAttachmentAssetForViewer(
      currentUser.id,
      attachmentId,
      'asset',
    );
    response.setHeader('Content-Type', asset.mimeType);
    response.setHeader('Cache-Control', 'private, max-age=31536000, immutable');

    return response.send(asset.buffer);
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
