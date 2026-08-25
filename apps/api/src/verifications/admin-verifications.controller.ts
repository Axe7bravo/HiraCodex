import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { AdminVerificationQueryDto } from './dto/admin-verification-query.dto';
import { ReviewVerificationDto } from './dto/review-verification.dto';
import { AdminVerificationsService } from './admin-verifications.service';

@Controller('admin/verifications')
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminVerificationsController {
  constructor(private readonly verifications: AdminVerificationsService) {}

  @Get()
  list(@Query() query: AdminVerificationQueryDto) {
    return this.verifications.list(query.type);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.verifications.getDetail(id);
  }

  @Get(':verificationId/documents/:documentId')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Cache-Control', 'private, no-store')
  async document(
    @Param('verificationId') verificationId: string,
    @Param('documentId') documentId: string,
    @Res() response: Response,
  ) {
    const document = await this.verifications.getDocument(
      verificationId,
      documentId,
    );
    response.type(document.mimeType ?? 'application/octet-stream');
    response.attachment(safeFilename(document.originalName));
    response.send(document.contents);
  }

  @Patch(':id')
  review(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @Body() input: ReviewVerificationDto,
  ) {
    return this.verifications.review(id, request.user.id, input);
  }
}

function safeFilename(originalName: string | null): string {
  const cleaned = originalName
    ?.replace(/[\r\n"\\/]/g, '_')
    .replace(/[^\x20-\x7E]/g, '_')
    .trim();
  return cleaned || 'verification-document';
}
