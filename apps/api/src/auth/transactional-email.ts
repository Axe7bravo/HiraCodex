type EmailAction = { label: string; url: string };

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character];
  });
}

// Dynamic content is always text, never caller-supplied HTML.
export function transactionalEmail(
  heading: string,
  message: string,
  action: EmailAction,
): { html: string; text: string } {
  const url = new URL(action.url);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('Transactional email links must use HTTP or HTTPS');
  }
  const footer = 'Hira — Verified student housing in Lesotho';
  const paragraphs = message
    .split('\n\n')
    .map(
      (paragraph) =>
        `<p style="margin:0 0 18px;line-height:1.65;overflow-wrap:anywhere">${escapeHtml(paragraph).replaceAll('\n', '<br>')}</p>`,
    )
    .join('');
  return {
    text: `${heading}\n\n${message}\n\n${action.label}: ${url.toString()}\n\n${footer}`,
    html: `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(heading)}</title></head>
<body style="margin:0;background:#f5f6f8;color:#171b23;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #dde1e7;border-top:4px solid #F0FF4D"><tr><td style="padding:28px 24px">
<p style="margin:0 0 28px;font-size:28px;font-weight:800;letter-spacing:-1px">Hira<span style="color:#1663FF">.</span></p>
<h1 style="margin:0 0 20px;font-size:24px;line-height:1.25">${escapeHtml(heading)}</h1>
${paragraphs}
<p style="margin:24px 0"><a href="${escapeHtml(url.toString())}" style="display:inline-block;background:#1663FF;color:#ffffff;padding:14px 22px;border-radius:6px;font-weight:700;text-decoration:none">${escapeHtml(action.label)}</a></p>
<p style="margin:28px 0 0;border-top:1px solid #dde1e7;padding-top:18px;font-size:12px;line-height:1.6;color:#596171">${footer}</p>
</td></tr></table></td></tr></table></body></html>`,
  };
}
