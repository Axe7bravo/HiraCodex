import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';

const mockSend = jest.fn();
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({ emails: { send: mockSend } })),
}));

describe('EmailService branded notifications', () => {
  const service = new EmailService(
    new ConfigService({
      RESEND_API_KEY: 'test-key',
      EMAIL_FROM: 'Hira <notifications@hira.example>',
      WEB_ORIGIN: 'https://hira.example',
    }),
  );
  const recipient = 'recipient@example.com';
  beforeEach(() => {
    mockSend.mockReset();
    mockSend.mockResolvedValue({ error: null });
  });

  const notifications: Array<[string, () => Promise<void>, string]> = [
    [
      'password reset',
      () => service.sendPasswordReset(recipient, 'test-token'),
      '/reset-password?token=test-token',
    ],
    [
      'verification approval',
      () => service.sendVerificationApproved(recipient),
      '/account/verification',
    ],
    [
      'verification rejection',
      () =>
        service.sendVerificationRejected(recipient, 'Clearer image please.'),
      '/account/verification',
    ],
    [
      'property approval',
      () => service.sendPropertyApproved(recipient),
      '/account/properties',
    ],
    [
      'property rejection',
      () => service.sendPropertyRejected(recipient, 'Add more detail.'),
      '/account/properties',
    ],
    [
      'new inquiry',
      () => service.sendNewInquiry(recipient),
      '/account/inquiries',
    ],
    [
      'new request',
      () => service.sendNewAccommodationRequest(recipient),
      '/account/requests',
    ],
    [
      'accepted request',
      () => service.sendAccommodationRequestAccepted(recipient),
      '/account/requests',
    ],
    [
      'declined request',
      () => service.sendAccommodationRequestDeclined(recipient, 'No vacancy.'),
      '/account/requests',
    ],
  ];

  it.each(notifications)(
    'sends HTML and text for %s to the unchanged recipient',
    async (_name, send, path) => {
      await send();
      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'Hira <notifications@hira.example>',
          to: recipient,
          html: expect.stringContaining(`href="https://hira.example${path}"`),
          text: expect.stringContaining(`https://hira.example${path}`),
        }),
      );
    },
  );

  it('renders rejection guidance as text, never markup', async () => {
    await service.sendPropertyRejected(recipient, '<script>private</script>');
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining('&lt;script&gt;private&lt;/script&gt;'),
        text: expect.stringContaining('<script>private</script>'),
      }),
    );
  });

  it('preserves reset expiry guidance and provider error handling', async () => {
    await service.sendPasswordReset(recipient, 'test-token');
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining(
          'expires in one hour and can only be used once',
        ),
      }),
    );
    mockSend.mockResolvedValueOnce({ error: { message: 'Provider failed' } });
    await expect(service.sendNewInquiry(recipient)).rejects.toThrow(
      'Transactional email delivery failed',
    );
  });
});
