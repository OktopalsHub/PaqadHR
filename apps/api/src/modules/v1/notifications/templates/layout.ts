import { EMAIL_BRAND, escapeHtml } from './brand';

export interface EmailLayoutOptions {
  preheader: string;
  content: string;
  /** Workspace the email is sent on behalf of; shown in the footer next to Paqad. */
  organizationName?: string;
  /** Workspace logo shown instead of the Paqad logo; must be an https URL. */
  organizationLogoUrl?: string | null;
}

export function renderEmailLayout({
  preheader,
  content,
  organizationName,
  organizationLogoUrl,
}: EmailLayoutOptions): string {
  const { logoUrl: paqadLogoUrl, pageBg, cardBg, footerBg, fontFamily, text, muted } = EMAIL_BRAND;

  const customLogo = organizationLogoUrl?.startsWith('https://') ? organizationLogoUrl : null;
  const logoUrl = escapeHtml(customLogo ?? paqadLogoUrl);
  const logoAlt = escapeHtml(customLogo && organizationName ? organizationName : 'Paqad');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>Paqad</title>
</head>
<body style="margin:0;padding:0;background-color:${pageBg};font-family:${fontFamily};color:${text};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:${pageBg};">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background-color:${cardBg};border-radius:12px;overflow:hidden;">
          <tr>
            <td align="center" style="padding:32px 32px 8px;">
              <img src="${logoUrl}" alt="${logoAlt}" style="display:block;border:0;height:auto;max-height:48px;max-width:160px;" />
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 32px;">
              ${content}
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:20px 32px 28px;background-color:${footerBg};border-top:1px solid #e4e4e7;font-size:12px;line-height:1.5;color:${muted};">
              ${organizationName ? `Sent by ${escapeHtml(organizationName)} via Paqad` : 'Sent by Paqad'}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
