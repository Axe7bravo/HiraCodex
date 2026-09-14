import { transactionalEmail } from './transactional-email';

describe('transactionalEmail', () => {
  it('escapes dynamic content and retains a readable plain-text fallback', () => {
    const result = transactionalEmail(
      '<script>alert("heading")</script>',
      'Review note: <img src=x onerror="alert(1)"> & retry.\n\nSecond paragraph.',
      { label: '<View>', url: 'https://hira.example/account?first=1&second=2' },
    );
    expect(result.html).not.toContain('<script>');
    expect(result.html).not.toContain('<img');
    expect(result.html).toContain(
      '&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; retry.',
    );
    expect(result.html).toContain('&lt;View&gt;');
    expect(result.html).toContain('first=1&amp;second=2');
    expect(result.html).toContain('Second paragraph.');
    expect(result.html).toContain('#1663FF');
    expect(result.text).toContain(
      'Review note: <img src=x onerror="alert(1)"> & retry.',
    );
    expect(result.text).toContain(
      'https://hira.example/account?first=1&second=2',
    );
    expect(result.text).toContain('Hira — Verified student housing in Lesotho');
  });

  it('does not allow executable link protocols', () => {
    expect(() =>
      transactionalEmail('Heading', 'Message', {
        label: 'Open',
        url: 'javascript:alert(1)',
      }),
    ).toThrow('Transactional email links must use HTTP or HTTPS');
  });
});
