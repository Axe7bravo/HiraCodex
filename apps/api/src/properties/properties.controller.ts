import {
  BadRequestException,
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
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { UserRole } from '@prisma/client';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import {
  ALLOWED_PROPERTY_PHOTO_MIME_TYPES,
  MAX_PROPERTY_PHOTO_SIZE,
  PropertiesService,
} from './properties.service';

@Controller('properties')
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles(UserRole.LANDLORD)
export class PropertiesController {
  constructor(private readonly properties: PropertiesService) {}

  @Get('mine')
  mine(@Req() request: AuthenticatedRequest) {
    return this.properties.mine(request.user.id);
  }

  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Body() input: CreatePropertyDto,
  ) {
    return this.properties.create(request.user.id, input);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @Body() input: UpdatePropertyDto,
  ) {
    return this.properties.update(id, request.user.id, input);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.properties.remove(id, request.user.id);
  }

  @Post(':id/photos')
  @UseInterceptors(
    FileInterceptor('photo', {
      limits: { fileSize: MAX_PROPERTY_PHOTO_SIZE, files: 1 },
      fileFilter: (_request, file, callback) => {
        if (
          !ALLOWED_PROPERTY_PHOTO_MIME_TYPES.includes(file.mimetype as never)
        ) {
          callback(
            new BadRequestException('Unsupported property photo type'),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  uploadPhoto(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @UploadedFile() photo?: Express.Multer.File,
  ) {
    if (!photo) throw new BadRequestException('A property photo is required');
    return this.properties.addPhoto(id, request.user.id, photo);
  }

  @Get(':id/photos/:photoId')
  async getPhoto(
    @Param('id') id: string,
    @Param('photoId') photoId: string,
    @Req() request: AuthenticatedRequest,
    @Res() response: Response,
  ) {
    const photo = await this.properties.getPhoto(id, photoId, request.user.id);
    response.set({
      'Content-Type': photo.mimeType,
      'Content-Length': String(photo.contents.length),
      'Cache-Control': 'private, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    });
    response.send(photo.contents);
  }

  @Delete(':id/photos/:photoId')
  deletePhoto(
    @Param('id') id: string,
    @Param('photoId') photoId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.properties.deletePhoto(id, photoId, request.user.id);
  }

  @Post(':id/submit-review')
  submitReview(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.properties.submitReview(id, request.user.id);
  }
}
