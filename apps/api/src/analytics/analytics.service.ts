import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { UserRole } from '@prisma/client';

type AnalyticsEvents = {
  registration_completed: { userId: string; role: UserRole };
  verification_submitted: { userId: string; role: UserRole };
  verification_approved: { userId: string; role: UserRole };
  property_created: { landlordId: string; propertyId: string };
  property_submitted_for_review: { landlordId: string; propertyId: string };
  property_approved: { landlordId: string; propertyId: string };
  favourite_added: { userId: string; propertyId: string };
  favourite_removed: { userId: string; propertyId: string };
  inquiry_created: {
    userId: string;
    propertyId: string;
    inquiryId: string;
  };
  accommodation_request_created: {
    userId: string;
    propertyId: string;
    requestId: string;
  };
  accommodation_request_accepted: {
    propertyId: string;
    requestId: string;
  };
  accommodation_request_declined: {
    propertyId: string;
    requestId: string;
  };
  accommodation_request_cancelled: {
    propertyId: string;
    requestId: string;
  };
};

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  private readonly apiKey: string | undefined;
  private readonly host: string | undefined;
  private failureLogged = false;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('POSTHOG_API_KEY')?.trim() || undefined;
    this.host = config.get<string>('POSTHOG_HOST')?.trim() || undefined;
  }

  capture<Event extends keyof AnalyticsEvents>(
    event: Event,
    distinctId: string,
    properties: AnalyticsEvents[Event],
  ): void {
    const apiKey = this.apiKey;
    const host = this.host;
    if (!apiKey || !host) return;
    void this.send(host, apiKey, event, distinctId, properties);
  }

  private async send(
    host: string,
    apiKey: string,
    event: keyof AnalyticsEvents,
    distinctId: string,
    properties: AnalyticsEvents[keyof AnalyticsEvents],
  ): Promise<void> {
    try {
      const response = await fetch(`${host.replace(/\/$/, '')}/capture/`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          event,
          properties: { distinct_id: distinctId, ...properties },
        }),
      });
      if (!response.ok) throw new Error('Analytics provider rejected event');
    } catch {
      if (!this.failureLogged) {
        this.failureLogged = true;
        this.logger.warn('Analytics event delivery failed');
      }
    }
  }
}
