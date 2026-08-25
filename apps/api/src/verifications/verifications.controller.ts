import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { AuthenticatedRequest } from '../auth/auth.types';
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
