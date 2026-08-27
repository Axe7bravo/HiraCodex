import { S3Client } from '@aws-sdk/client-s3';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resolve } from 'node:path';
import { AuthModule } from '../auth/auth.module';
import { PropertiesController } from './properties.controller';
import { PropertiesService } from './properties.service';
import { PROPERTY_PHOTO_STORAGE } from './property-photo-storage';
import { LocalPropertyPhotoStorage } from './local-property-photo.storage';
import { S3PropertyPhotoStorage } from './s3-property-photo.storage';
import { AdminPropertiesController } from './admin-properties.controller';
import { AdminPropertiesService } from './admin-properties.service';
import { DiscoveryPropertiesController } from './discovery-properties.controller';
import { DiscoveryPropertiesService } from './discovery-properties.service';
import { FavouritesController } from './favourites.controller';
import { FavouritesService } from './favourites.service';
import { InquiriesController } from './inquiries.controller';
import { InquiriesService } from './inquiries.service';

@Module({
  imports: [AuthModule],
  controllers: [
    PropertiesController,
    AdminPropertiesController,
    DiscoveryPropertiesController,
    FavouritesController,
    InquiriesController,
  ],
  providers: [
    PropertiesService,
    AdminPropertiesService,
    DiscoveryPropertiesService,
    FavouritesService,
    InquiriesService,
    {
      provide: PROPERTY_PHOTO_STORAGE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        if (config.get<string>('PROPERTY_STORAGE_DRIVER') === 's3') {
          return new S3PropertyPhotoStorage(
            new S3Client({
              endpoint: config.get<string>('PROPERTY_S3_ENDPOINT'),
              region: config.get<string>('PROPERTY_S3_REGION') ?? 'auto',
              credentials: {
                accessKeyId: config.getOrThrow<string>(
                  'PROPERTY_S3_ACCESS_KEY_ID',
                ),
                secretAccessKey: config.getOrThrow<string>(
                  'PROPERTY_S3_SECRET_ACCESS_KEY',
                ),
              },
            }),
            config.getOrThrow<string>('PROPERTY_S3_BUCKET'),
          );
        }
        return new LocalPropertyPhotoStorage(
          config.get<string>('PROPERTY_LOCAL_STORAGE_DIR') ??
            resolve(process.cwd(), '.private-property-photos'),
        );
      },
    },
  ],
})
export class PropertiesModule {}
