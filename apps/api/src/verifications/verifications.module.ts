import { S3Client } from '@aws-sdk/client-s3';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resolve } from 'node:path';
import { AuthModule } from '../auth/auth.module';
import { LocalVerificationDocumentStorage } from './local-verification-document.storage';
import { S3VerificationDocumentStorage } from './s3-verification-document.storage';
import { VERIFICATION_DOCUMENT_STORAGE } from './verification-document-storage';
import { VerificationsController } from './verifications.controller';
import { VerificationsService } from './verifications.service';
import { AdminVerificationsController } from './admin-verifications.controller';
import { AdminVerificationsService } from './admin-verifications.service';

@Module({
  imports: [AuthModule],
  controllers: [VerificationsController, AdminVerificationsController],
  providers: [
    VerificationsService,
    AdminVerificationsService,
    {
      provide: VERIFICATION_DOCUMENT_STORAGE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        if (config.get<string>('VERIFICATION_STORAGE_DRIVER') === 's3') {
          return new S3VerificationDocumentStorage(
            new S3Client({
              endpoint: config.get<string>('VERIFICATION_S3_ENDPOINT'),
              region: config.get<string>('VERIFICATION_S3_REGION') ?? 'auto',
              credentials: {
                accessKeyId: config.getOrThrow<string>(
                  'VERIFICATION_S3_ACCESS_KEY_ID',
                ),
                secretAccessKey: config.getOrThrow<string>(
                  'VERIFICATION_S3_SECRET_ACCESS_KEY',
                ),
              },
            }),
            config.getOrThrow<string>('VERIFICATION_S3_BUCKET'),
          );
        }

        return new LocalVerificationDocumentStorage(
          config.get<string>('VERIFICATION_LOCAL_STORAGE_DIR') ??
            resolve(process.cwd(), '.private-verification-uploads'),
        );
      },
    },
  ],
})
export class VerificationsModule {}
