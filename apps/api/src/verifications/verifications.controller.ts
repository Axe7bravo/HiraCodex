import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  Res,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { AuthenticatedRequest } from '../auth/auth.types';
import type { Response } from 'express';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import {
  ALLOWED_VERIFICATION_MIME_TYPES,
  MAX_VERIFICATION_FILE_SIZE,
  VerificationsService,
} from './verifications.service';

@Controller('verifications')
@UseGuards(SessionAuthGuard)
export class VerificationsController {
  constructor(private readonly verifications: VerificationsService) {}

  @Get('me')
  getMine(@Req() request: AuthenticatedRequest) {
    return this.verifications.getMine(request.user.id, request.user.role);
  }

  @Get('me/documents/:documentId')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Cache-Control', 'private, no-store')
  async document(
    @Req() request: AuthenticatedRequest,
    @Param('documentId') documentId: string,
    @Res() response: Response,
  ) {
    const document = await this.verifications.getMineDocument(
      request.user.id,
      request.user.role,
      documentId,
    );
    response.type(document.mimeType ?? 'application/octet-stream');
    response.attachment(safeFilename(document.originalName));
    response.send(document.contents);
  }

  @Post()
  @UseInterceptors(
    FilesInterceptor('documents', 3, {
      limits: { fileSize: MAX_VERIFICATION_FILE_SIZE, files: 3 },
      fileFilter: (_request, file, callback) => {
        if (
          !ALLOWED_VERIFICATION_MIME_TYPES.includes(
            file.mimetype as (typeof ALLOWED_VERIFICATION_MIME_TYPES)[number],
          )
        ) {
          callback(
            new BadRequestException('Unsupported verification document type'),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  submit(
    @Req() request: AuthenticatedRequest,
    @UploadedFiles() files: Express.Multer.File[] = [],
    @Body() body: Record<string, unknown> = {},
  ) {
    if (Object.keys(body).length > 0) {
      throw new BadRequestException(
        'Verification submissions accept documents only',
      );
    }
    return this.verifications.submit(request.user.id, request.user.role, files);
  }
}

function safeFilename(originalName: string | null): string {
  const cleaned = originalName
    ?.replace(/[\r\n"\\/]/g, '_')
    .replace(/[^\x20-\x7E]/g, '_')
    .trim();
  return cleaned || 'verification-document';
}
