import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    Object.defineProperty(global, 'fetch', {
      configurable: true,
      value: fetchMock,
    });
  });

  it('is a no-op without provider configuration', () => {
    const service = new AnalyticsService(new ConfigService());

    service.capture('registration_completed', 'user-1', {
      userId: 'user-1',
      role: UserRole.TENANT,
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends only the explicit event properties', async () => {
    fetchMock.mockResolvedValue({ ok: true });
    const service = configuredService();

    service.capture('inquiry_created', 'tenant-1', {
      userId: 'tenant-1',
      propertyId: 'property-1',
      inquiryId: 'inquiry-1',
    });
    await Promise.resolve();

    const expectedBody = JSON.stringify({
      api_key: 'project-key',
      event: 'inquiry_created',
      properties: {
        distinct_id: 'tenant-1',
        userId: 'tenant-1',
        propertyId: 'property-1',
        inquiryId: 'inquiry-1',
      },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://analytics.example/capture/',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: expectedBody,
      },
    );
    expect(expectedBody).not.toContain('message');
  });

  it('does not throw when provider delivery fails', () => {
    fetchMock.mockRejectedValue(new Error('Provider unavailable'));
    const service = configuredService();

    expect(() =>
      service.capture('favourite_added', 'tenant-1', {
        userId: 'tenant-1',
        propertyId: 'property-1',
      }),
    ).not.toThrow();
  });

  function configuredService() {
    return new AnalyticsService(
      new ConfigService({
        POSTHOG_API_KEY: 'project-key',
        POSTHOG_HOST: 'https://analytics.example',
      }),
    );
  }
});
