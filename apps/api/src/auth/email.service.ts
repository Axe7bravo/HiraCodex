import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

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
      text: `Reset your Hira password using this link: ${resetUrl.toString()}\n\nThis link expires in one hour and can only be used once.`,
    });

    if (error) throw new Error('Transactional email delivery failed');
  }

  sendVerificationApproved(to: string): Promise<void> {
    return this.send(
      to,
      'Your Hira verification was approved',
      'Your Hira verification has been approved. Your verified status is now visible in your account.',
    );
  }

  sendVerificationRejected(to: string, reason: string): Promise<void> {
    return this.send(
      to,
      'Action needed for your Hira verification',
      `Your Hira verification was not approved. Reason: ${reason}\n\nYou may sign in and submit new documents.`,
    );
  }

  sendPropertyApproved(to: string): Promise<void> {
    return this.send(
      to,
      'Your Hira property listing is approved',
      'Your property listing has been approved and is now active on Hira.',
    );
  }

  sendPropertyRejected(to: string, reason: string): Promise<void> {
    return this.send(
      to,
      'Action needed for your Hira property listing',
      `Your property listing needs changes before approval. Reason: ${reason}\n\nYou may edit the listing and submit it for review again.`,
    );
  }

  sendNewInquiry(to: string): Promise<void> {
    return this.send(
      to,
      'New inquiry on your Hira property',
      'A tenant sent an inquiry about one of your properties. Sign in to Hira to review it.',
    );
  }

  private async send(to: string, subject: string, text: string): Promise<void> {
    const apiKey = this.config.getOrThrow<string>('RESEND_API_KEY');
    const from = this.config.getOrThrow<string>('EMAIL_FROM');
    const { error } = await new Resend(apiKey).emails.send({
      from,
      to,
      subject,
      text,
    });
    if (error) throw new Error('Transactional email delivery failed');
  }
}
