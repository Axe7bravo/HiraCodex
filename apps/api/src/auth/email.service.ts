import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { transactionalEmail } from './transactional-email';

@Injectable()
export class EmailService {
  constructor(private readonly config: ConfigService) {}

  async sendPasswordReset(to: string, token: string): Promise<void> {
    const apiKey = this.config.getOrThrow<string>('RESEND_API_KEY');
    const from = this.config.getOrThrow<string>('EMAIL_FROM');
    const webOrigin = this.config.getOrThrow<string>('WEB_ORIGIN');
    const resetUrl = new URL('/reset-password', webOrigin);
    resetUrl.searchParams.set('token', token);

    const { error } = await new Resend(apiKey).emails.send({
      from,
      to,
      subject: 'Reset your Hira password',
      ...transactionalEmail(
        'Reset your Hira password',
        'Use the button below to reset your password. This link expires in one hour and can only be used once.\n\nIf you did not request a reset, you can ignore this email.',
        { label: 'Reset password', url: resetUrl.toString() },
      ),
    });

    if (error) throw new Error('Transactional email delivery failed');
  }

  sendVerificationApproved(to: string): Promise<void> {
    return this.send(
      to,
      'You’re verified',
      'Your Hira verification has been approved. Your verified status is now visible in your account.',
      '/account/verification',
      'View verification',
    );
  }

  sendVerificationRejected(to: string, reason: string): Promise<void> {
    return this.send(
      to,
      'We couldn’t verify your documents',
      `Your Hira verification was not approved. Reason: ${reason}\n\nYou may sign in and submit new documents.`,
      '/account/verification',
      'Review verification',
    );
  }

  sendPropertyApproved(to: string): Promise<void> {
    return this.send(
      to,
      'Your property is live',
      'Your property listing has been approved and is now active on Hira.',
      '/account/properties',
      'View listings',
    );
  }

  sendPropertyRejected(to: string, reason: string): Promise<void> {
    return this.send(
      to,
      'Your property needs changes',
      `Your property listing needs changes before approval. Reason: ${reason}\n\nYou may edit the listing and submit it for review again.`,
      '/account/properties',
      'Review property',
    );
  }

  sendNewInquiry(to: string): Promise<void> {
    return this.send(
      to,
      'New inquiry on your Hira property',
      'A tenant sent an inquiry about one of your properties. Sign in to Hira to review it.',
      '/account/inquiries',
      'Review inquiries',
    );
  }

  sendNewAccommodationRequest(to: string): Promise<void> {
    return this.send(
      to,
      'New accommodation request on Hira',
      'A tenant submitted an accommodation request for one of your properties. Sign in to Hira to review it.',
      '/account/requests',
      'Review requests',
    );
  }

  sendAccommodationRequestAccepted(to: string): Promise<void> {
    return this.send(
      to,
      'Your Hira accommodation request was accepted',
      'A landlord accepted your accommodation request. Sign in to Hira to review its status and continue through the agreed contact channel.',
      '/account/requests',
      'View requests',
    );
  }

  sendAccommodationRequestDeclined(to: string, reason: string): Promise<void> {
    return this.send(
      to,
      'Update on your Hira accommodation request',
      `A landlord declined your accommodation request. Reason: ${reason}\n\nSign in to Hira to review its status.`,
      '/account/requests',
      'View requests',
    );
  }

  private async send(
    to: string,
    subject: string,
    text: string,
    path: string,
    actionLabel: string,
  ): Promise<void> {
    const apiKey = this.config.getOrThrow<string>('RESEND_API_KEY');
    const from = this.config.getOrThrow<string>('EMAIL_FROM');
    const { error } = await new Resend(apiKey).emails.send({
      from,
      to,
      subject,
      ...transactionalEmail(subject, text, {
        label: actionLabel,
        url: new URL(
          path,
          this.config.getOrThrow<string>('WEB_ORIGIN'),
        ).toString(),
      }),
    });
    if (error) throw new Error('Transactional email delivery failed');
  }
}
